import { createError, defineEventHandler, getHeader, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { authenticateDevice } from "@/lib/phone-bridge-auth";

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

  await authenticateDevice(event, deviceId);

  const body = asObject(await readBody(event).catch(() => null));
  const device = asObject(body.device);
  const snapshotHash = asString(body.snapshotHash).slice(0, 128);

  const sql = await getSql();
  await sql.query(
    `insert into phone_bridge_devices
      (id,name,manufacturer,model,android_version,sdk_int,last_seen_at)
     values ($1,$2,$3,$4,$5,$6,current_timestamp)
     on conflict (id) do update set
       name=excluded.name,
       manufacturer=excluded.manufacturer,
       model=excluded.model,
       android_version=excluded.android_version,
       sdk_int=excluded.sdk_int,
       last_seen_at=current_timestamp,
       last_snapshot_hash=case when $7 <> '' then $7 else phone_bridge_devices.last_snapshot_hash end`,
    [
      deviceId,
      asString(device.name, "گوشی"),
      asString(device.manufacturer),
      asString(device.model),
      asString(device.androidVersion),
      Number.isInteger(device.sdkInt) ? device.sdkInt : null,
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
