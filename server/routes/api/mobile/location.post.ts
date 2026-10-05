import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });
  }

  const device = await requireStaffMobileDevice(event);
  const rate = consumeStaffMobileRateLimit("location", device.device_id, {
    windowMs: 10 * 60 * 1000,
    maxHits: 120,
  });
  if (!rate.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: "تعداد درخواست‌های موقعیت بیش از حد مجاز است.",
      data: { retryAfterSeconds: rate.retryAfterSeconds },
    });
  }

  const body = await readBody(event).catch(() => ({})) as Record<string, unknown>;
  const points = Array.isArray(body.points) ? body.points.slice(0, 100) : [];
  if (!points.length) {
    throw createError({ statusCode: 400, statusMessage: "نقطه موقعیت ارسالی وجود ندارد." });
  }

  const sql = await getSql();
  let accepted = 0;
  let rejected = 0;

  for (const item of points) {
    if (!item || typeof item !== "object") {
      rejected++;
      continue;
    }

    const row = item as Record<string, unknown>;
    const clientEventId = cleanText(row.clientEventId, 100);
    const latitude = finiteNumber(row.latitude);
    const longitude = finiteNumber(row.longitude);
    const accuracy = finiteNumber(row.accuracyM);
    const altitude = finiteNumber(row.altitudeM);
    const speed = finiteNumber(row.speedMps);
    const provider = cleanText(row.provider, 32);
    const observedAt = validIso(row.observedAt);

    if (
      !/^[a-zA-Z0-9._:-]{8,100}$/.test(clientEventId) ||
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !observedAt
    ) {
      rejected++;
      continue;
    }

    if (accuracy !== null && (accuracy < 0 || accuracy > 1_000_000)) {
      rejected++;
      continue;
    }

    if (speed !== null && (speed < 0 || speed > 1000)) {
      rejected++;
      continue;
    }

    const rows = await sql.query<{ id: string }>(
      "insert into staff_mobile_locations " +
        "(id,device_id,staff_id,client_event_id,latitude,longitude,accuracy_m,altitude_m,speed_mps,provider,observed_at) " +
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
        "on conflict (device_id,client_event_id) do nothing " +
        "returning id",
      [randomUUID(), device.device_id, device.staff_id, clientEventId, latitude, longitude, accuracy, altitude, speed, provider, observedAt],
    );

    accepted++;
    if (!rows.length) continue;
  }

  await sql.query(
    "insert into staff_mobile_ingest_log " +
      "(id,device_id,staff_id,endpoint,accepted_count,rejected_count) " +
      "values ($1,$2,$3,$4,$5,$6)",
    [randomUUID(), device.device_id, device.staff_id, "/api/mobile/location", accepted, rejected],
  );

  await sql.query(
    "update staff_mobile_devices set last_seen_at=current_timestamp where id=$1",
    [device.id],
  );

  return {
    success: true,
    accepted,
    rejected,
    remainingRateLimit: rate.remaining,
  };
});
