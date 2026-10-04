import { createError, defineEventHandler, getHeader, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { authenticateDevice } from "@/lib/phone-bridge-auth";
import { recordPhoneBridgeEvent } from "@/lib/phone-bridge-events.server";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای Heartbeat در دسترس نیست." });
  }

  const deviceId = getHeader(event, "x-hirmand-device-id")?.trim().slice(0, 120) ?? "";
  if (!deviceId) {
    throw createError({ statusCode: 400, statusMessage: "شناسهٔ دستگاه ارسال نشده است." });
  }

  try {
    await authenticateDevice(event, deviceId);
  } catch (error) {
    await recordPhoneBridgeEvent({
      deviceId,
      eventType: "security.auth_failed",
      severity: "error",
      message: "احراز هویت دستگاه برای Heartbeat ناموفق بود.",
      metadata: { route: "/api/device-sync/v1/heartbeat" },
    }).catch(() => undefined);
    throw error;
  }

  const body = asObject(await readBody(event).catch(() => null));
  const device = asObject(body.device);
  const queue = asObject(body.queue);
  const snapshotHash = asString(body.snapshotHash).slice(0, 128);
  const queued = Number.isInteger(queue.queued) && queue.queued >= 0 ? Math.min(queue.queued, 10000) : 0;
  const deadLetters = Number.isInteger(queue.deadLetters) && queue.deadLetters >= 0 ? Math.min(queue.deadLetters, 10000) : 0;
  const reportedAt = Number.isInteger(queue.reportedAt) ? new Date(queue.reportedAt) : new Date();
  const healthReportAt = Number.isFinite(reportedAt.getTime()) ? reportedAt.toISOString() : new Date().toISOString();

  const sql = await getSql();
  await sql.query(
    `insert into phone_bridge_devices
      (id,name,manufacturer,model,android_version,sdk_int,last_seen_at,last_queue_count,last_dead_letter_count,last_health_report_at)
     values ($1,$2,$3,$4,$5,$6,current_timestamp,$7,$8,$9)
     on conflict (id) do update set
       name=excluded.name,
       manufacturer=excluded.manufacturer,
       model=excluded.model,
       android_version=excluded.android_version,
       sdk_int=excluded.sdk_int,
       last_seen_at=current_timestamp,
       last_queue_count=$7,
       last_dead_letter_count=$8,
       last_health_report_at=$9,
       last_snapshot_hash=case when $10 <> '' then $10 else phone_bridge_devices.last_snapshot_hash end`,
    [
      deviceId,
      asString(device.name, "گوشی"),
      asString(device.manufacturer),
      asString(device.model),
      asString(device.androidVersion),
      Number.isInteger(device.sdkInt) ? device.sdkInt : null,
      queued,
      deadLetters,
      healthReportAt,
      snapshotHash,
    ],
  );

  return {
    ok: true,
    deviceId,
    snapshotHash: snapshotHash || null,
    receivedAt: new Date().toISOString(),
  };
});
