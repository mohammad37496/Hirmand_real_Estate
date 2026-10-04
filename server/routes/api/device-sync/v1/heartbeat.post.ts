import { createError, defineEventHandler, getHeader, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { authenticateDevice } from "@/lib/phone-bridge-auth";
import { recordPhoneBridgeEvent } from "@/lib/phone-bridge-events.server";
import { enforcePhoneBridgeRateLimit } from "@/lib/phone-bridge-rate-limit.server";

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

  await enforcePhoneBridgeRateLimit(event, "heartbeat", deviceId, {
    windowMs: 10 * 60 * 1000,
    maxHits: 30,
    blockMs: 10 * 60 * 1000,
  });
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

  const sql = await getSql();
  const policyRows = await sql.query<{ policy_revision: number; last_snapshot_policy_revision: number }>(
    `select policy_revision,last_snapshot_policy_revision from phone_bridge_devices where id=$1 limit 1`,
    [deviceId],
  );
  const policyRevision = Number(policyRows[0]?.policy_revision ?? 1);
  const appliedPolicyRevision = Number(policyRows[0]?.last_snapshot_policy_revision ?? 1);
  const snapshotRequired = policyRevision !== appliedPolicyRevision;

  const body = asObject(await readBody(event).catch(() => null));
  const device = asObject(body.device);
  const queue = asObject(body.queue);
  const stats = asObject(body.deviceStats);
  const snapshotHash = asString(body.snapshotHash).slice(0, 128);
  const batteryPercent = typeof stats.batteryPercent === "number" && Number.isInteger(stats.batteryPercent)
    ? Math.max(0, Math.min(100, stats.batteryPercent))
    : null;
  const batteryCharging = typeof stats.batteryCharging === "boolean" ? stats.batteryCharging : null;
  const storageAvailableBytes = typeof stats.storageAvailableBytes === "number" && Number.isSafeInteger(stats.storageAvailableBytes)
    ? Math.max(0, stats.storageAvailableBytes)
    : null;
  const storageTotalBytes = typeof stats.storageTotalBytes === "number" && Number.isSafeInteger(stats.storageTotalBytes)
    ? Math.max(0, stats.storageTotalBytes)
    : null;
  const ramAvailableBytes = typeof stats.ramAvailableBytes === "number" && Number.isSafeInteger(stats.ramAvailableBytes)
    ? Math.max(0, stats.ramAvailableBytes)
    : null;
  const ramTotalBytes = typeof stats.ramTotalBytes === "number" && Number.isSafeInteger(stats.ramTotalBytes)
    ? Math.max(0, stats.ramTotalBytes)
    : null;
  const queued = Number.isInteger(queue.queued) && queue.queued >= 0 ? Math.min(queue.queued, 10000) : 0;
  const deadLetters = Number.isInteger(queue.deadLetters) && queue.deadLetters >= 0 ? Math.min(queue.deadLetters, 10000) : 0;
  const reportedAt = Number.isInteger(queue.reportedAt) ? new Date(queue.reportedAt) : new Date();
  const healthReportAt = Number.isFinite(reportedAt.getTime()) ? reportedAt.toISOString() : new Date().toISOString();

  await sql.query(
    `insert into phone_bridge_health_history
      (device_id,battery_percent,battery_charging,storage_available_bytes,storage_total_bytes,ram_available_bytes,ram_total_bytes,queued_packets,dead_letter_packets)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      deviceId,
      batteryPercent,
      batteryCharging,
      storageAvailableBytes,
      storageTotalBytes,
      ramAvailableBytes,
      ramTotalBytes,
      queued,
      deadLetters,
    ],
  );

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
    snapshotRequired,
    policyRevision,
    receivedAt: new Date().toISOString(),
  };
});
