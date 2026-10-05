import { createError, defineEventHandler, setResponseHeader } from "h3";
import { authenticateSignedRequest, readSignedBody, computeEffectiveAccess, assertModuleAllowed } from "@/lib/phone-bridge-auth.server";
import { storeLocation, writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { locationPointSchema, msToIso, toEpochMs } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

/**
 * Location ingest (`POST /api/device-sync/v1/location`).
 *
 * Each fix is deduplicated on `(device_id, client_point_id)`, so a device that
 * retries after a dropped connection does not create a second row for the same
 * point. A fix with no usable timestamp is refused rather than defaulted to
 * "now" — a fabricated timestamp is worse than a rejected packet, because it
 * corrupts the ordering the admin reads the trail by.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("location", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد ارسال موقعیت بیش از حد مجاز است." });
  }

  const access = await computeEffectiveAccess(auth.device, auth.sql);
  assertModuleAllowed(access, "location");

  const raw = await readSignedBody(event);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "محتوای درخواست JSON معتبر نیست." });
  }

  const parsed = locationPointSchema.safeParse(json);
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: "نقطهٔ موقعیت معتبر نیست." });
  }

  const point = parsed.data;
  const recordedAtMs = toEpochMs(point.recordedAt) ?? toEpochMs(point.timestamp);
  if (recordedAtMs === null) {
    throw createError({ statusCode: 422, statusMessage: "زمان ثبت موقعیت معتبر نیست." });
  }

  const result = await storeLocation(auth.sql, {
    deviceId: auth.device.id,
    clientPointId: point.clientPointId,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracyMeters: point.accuracyMeters,
    altitudeMeters: point.altitudeMeters,
    speedMps: point.speedMps,
    bearingDegrees: point.bearingDegrees,
    provider: point.provider,
    recordedAtMs,
    recordedAtIso: msToIso(recordedAtMs)!,
  });

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "location.record",
    module: "location",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: { stored: result.stored, clientPointId: point.clientPointId },
  });

  return { ok: true, stored: result.stored, deduplicated: !result.stored };
});