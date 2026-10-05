import { createError, defineEventHandler, setResponseHeader } from "h3";
import { authenticateSignedRequest, readSignedBody, computeEffectiveAccess, recordSuccessfulSync } from "@/lib/phone-bridge-auth.server";
import { storeSnapshot, writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { payloadModuleGate } from "@/lib/phone-bridge-policy.server";
import { stripDisallowedModules, syncPacketSchema } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

/**
 * The signed sync packet (`POST /api/device-sync/v1`).
 *
 * Three gates apply here, in this order:
 *   1. HMAC + replay (authenticateSignedRequest)
 *   2. Rate limit
 *   3. Consent ∩ policy — any module the device is not cleared for is stripped
 *      from the payload *before* it is persisted, so un-authorised data never
 *      reaches a row even if a modified client sent it.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("sync", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد درخواست‌های همگام‌سازی بیش از حد مجاز است." });
  }

  const raw = await readSignedBody(event);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "محتوای درخواست JSON معتبر نیست." });
  }

  const parsed = syncPacketSchema.safeParse(json);
  if (!parsed.success) {
    await writePhoneBridgeAudit({
      deviceId: auth.device.id,
      action: "device.sync",
      result: "error",
      ip: auth.clientIp,
      userAgent: auth.userAgent,
      detail: { reason: "invalid_payload" },
    });
    throw createError({ statusCode: 422, statusMessage: "ساختار بستهٔ همگام‌سازی معتبر نیست." });
  }

  // A packet claiming a different device than the one that signed it is refused
  // outright rather than silently re-attributed.
  if (parsed.data.device.id && parsed.data.device.id !== auth.device.id) {
    await writePhoneBridgeAudit({
      deviceId: auth.device.id,
      action: "device.sync",
      result: "denied",
      ip: auth.clientIp,
      userAgent: auth.userAgent,
      detail: { reason: "device_id_mismatch" },
    });
    throw createError({ statusCode: 403, statusMessage: "شناسهٔ دستگاه در بسته با توکن هم‌خوانی ندارد." });
  }

  const access = await computeEffectiveAccess(auth.device, auth.sql);
  const cleaned = stripDisallowedModules(parsed.data, payloadModuleGate(access));
  const removedModules = Object.keys(parsed.data).filter(
    (key) => key in cleaned === false && ["wifi", "location", "contacts", "calls", "sms", "calendar", "apps"].includes(key),
  );

  const snapshotHash = cleaned.snapshotHash ?? "";
  const result = await storeSnapshot(auth.sql, {
    deviceId: auth.device.id,
    syncId: cleaned.syncId,
    snapshotHash,
    schema: cleaned.schema,
    appVersionName: cleaned.device.appVersionName,
    appVersionCode: cleaned.device.appVersionCode,
    payload: cleaned as unknown as Record<string, unknown>,
  });

  await recordSuccessfulSync(
    auth.sql,
    auth.device.id,
    snapshotHash,
    cleaned.device.appVersionName,
    cleaned.device.appVersionCode,
  );

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "device.sync",
    module: removedModules.join(",") || "base",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: {
      stored: result.stored,
      snapshotHash,
      strippedModules: removedModules,
    },
  });

  return {
    ok: true,
    stored: result.stored,
    deduplicated: !result.stored,
    effectiveModules: access.effective,
  };
});