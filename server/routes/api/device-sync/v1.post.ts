import { randomUUID } from "node:crypto";
import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { authenticateDevice } from "@/lib/phone-bridge-auth";
import { recordPhoneBridgeEvent } from "@/lib/phone-bridge-events.server";
import { enforcePhoneBridgeRateLimit } from "@/lib/phone-bridge-rate-limit.server";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && Number.isSafeInteger(value) ? value : null;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function summaryFor(payload: JsonObject) {
  return {
    contacts: arrayCount(payload.contacts),
    calls: arrayCount(payload.calls),
    sms: arrayCount(payload.sms),
    calendar: arrayCount(payload.calendar),
    apps: arrayCount(payload.apps),
    selectedFiles: arrayCount(payload.selectedFiles),
    hasLocation: Boolean(payload.location),
    hasWifi: Boolean(payload.wifi),
    hasDeviceStats: Boolean(payload.deviceStats),
  };
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای دریافت دادهٔ گوشی در دسترس نیست." });
  }

  const payload = asObject(await readBody(event).catch(() => null));
  const device = asObject(payload.device);
  const deviceId = asString(device.id);

  if (!deviceId) {
    throw createError({ statusCode: 400, statusMessage: "شناسهٔ نصب گوشی ارسال نشده است." });
  }
  await enforcePhoneBridgeRateLimit(event, "sync", deviceId, {
    windowMs: 10 * 60 * 1000,
    maxHits: 120,
    blockMs: 10 * 60 * 1000,
  });
  try {
    await authenticateDevice(event, deviceId);
  } catch (error) {
    await recordPhoneBridgeEvent({
      deviceId,
      eventType: "security.auth_failed",
      severity: "error",
      message: "احراز هویت دستگاه برای Sync ناموفق بود.",
      metadata: { route: "/api/device-sync/v1" },
    }).catch(() => undefined);
    throw error;
  }

  const schemaName = asString(payload.schema);
  if (schemaName !== "hirmand.phone-bridge.v1") {
    throw createError({ statusCode: 400, statusMessage: "نسخهٔ دادهٔ Phone Bridge پشتیبانی نمی‌شود." });
  }

  const encoded = JSON.stringify(payload);
  const payloadBytes = Buffer.byteLength(encoded, "utf8");
  if (payloadBytes > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "حجم بستهٔ Phone Bridge بیش از حد مجاز است." });
  }

  const syncId = asString(payload.syncId) || randomUUID();
  const summary = summaryFor(payload);
  const sentAtRaw = typeof payload.sentAt === "number" && Number.isFinite(payload.sentAt)
    ? new Date(payload.sentAt)
    : null;
  const sentAt = sentAtRaw && Number.isFinite(sentAtRaw.getTime()) ? sentAtRaw.toISOString() : null;

  const sql = await getSql();

  await sql.query(
    `insert into phone_bridge_devices
      (id,name,manufacturer,model,android_version,sdk_int,last_seen_at,last_sync_id,last_summary)
     values ($1,$2,$3,$4,$5,$6,current_timestamp,$7,$8::jsonb)
     on conflict (id) do update set
       name=excluded.name,
       manufacturer=excluded.manufacturer,
       model=excluded.model,
       android_version=excluded.android_version,
       sdk_int=excluded.sdk_int,
       last_seen_at=current_timestamp,
       last_sync_id=excluded.last_sync_id,
       last_summary=excluded.last_summary`,
    [
      deviceId,
      asString(device.name, "گوشی"),
      asString(device.manufacturer),
      asString(device.model),
      asString(device.androidVersion),
      asInt(device.sdkInt),
      syncId,
      JSON.stringify(summary),
    ],
  );

  const inserted = await sql.query<{ id: string }>(
    `insert into phone_bridge_syncs
      (id,device_id,schema_name,sent_at,payload_bytes,summary,payload)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     on conflict (id) do nothing
     returning id`,
    [
      syncId,
      deviceId,
      schemaName,
      sentAt,
      payloadBytes,
      JSON.stringify(summary),
      encoded,
    ],
  );

  return {
    ok: true,
    accepted: inserted.length > 0,
    syncId,
    deviceId,
    receivedAt: new Date().toISOString(),
    summary,
  };
});
