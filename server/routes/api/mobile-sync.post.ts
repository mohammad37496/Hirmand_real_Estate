import { createError, defineEventHandler, getHeader, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  assertMobilePayloadSize,
  generateMobileAccessToken,
  hashMobileAccessToken,
  hashMobilePairingCode,
  mobileRegistrationSchema,
  mobileSyncSchema,
  readBearerToken,
} from "@/lib/mobile-ingest.server";

async function claimPairingCode(code: string, deviceId: string) {
  const sql = await getSql();
  const result = await sql.query<{ id: string }>(
    `update mobile_pairing_codes
     set used_at = current_timestamp, used_device_id = $2
     where code_hash = $1
       and used_at is null
       and expires_at > current_timestamp
     returning id`,
    [hashMobilePairingCode(code), deviceId],
  );
  return result[0]?.id ?? null;
}

async function findDeviceByToken(token: string) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string; enabled: boolean }>(
    "select id, enabled from mobile_devices where access_token_hash = $1 limit 1",
    [hashMobileAccessToken(token)],
  );
  const device = rows[0];
  if (!device) throw createError({ statusCode: 401, statusMessage: "توکن دستگاه معتبر نیست." });
  if (!device.enabled) throw createError({ statusCode: 403, statusMessage: "این دستگاه از دسترسی به همگام‌سازی منع شده است." });
  return device;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای دریافت اطلاعات دستگاه تنظیم نشده است." });
  }

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "register") {
    const data = mobileRegistrationSchema.parse(body);
    const pairingId = await claimPairingCode(data.pairingCode, data.deviceId);
    if (!pairingId) {
      throw createError({ statusCode: 401, statusMessage: "کد جفت‌سازی نامعتبر، منقضی یا قبلاً مصرف شده است." });
    }

    const accessToken = generateMobileAccessToken();
    const tokenHash = hashMobileAccessToken(accessToken);
    const sql = await getSql();

    await sql.query(
      `insert into mobile_devices (
         id, platform, app_version, device_model, os_version, device_label,
         access_token_hash, enabled, first_seen_at, last_seen_at, metadata
       )
       values ($1,$2,$3,$4,$5,$6,$7,true,current_timestamp,current_timestamp,$8::jsonb)
       on conflict (id) do update set
         platform = excluded.platform,
         app_version = excluded.app_version,
         device_model = excluded.device_model,
         os_version = excluded.os_version,
         device_label = excluded.device_label,
         access_token_hash = excluded.access_token_hash,
         enabled = true,
         last_seen_at = current_timestamp,
         metadata = excluded.metadata`,
      [
        data.deviceId, data.platform, data.appVersion, data.deviceModel, data.osVersion,
        data.deviceLabel, tokenHash, JSON.stringify(data.metadata ?? {}),
      ],
    );

    return { ok: true, apiVersion: 1, deviceId: data.deviceId, accessToken, serverTime: new Date().toISOString() };
  }

  if (action === "sync") {
    const token = readBearerToken(getHeader(event, "authorization"));
    if (!token) throw createError({ statusCode: 401, statusMessage: "Authorization دستگاه ارسال نشده است." });
    const device = await findDeviceByToken(token);
    const data = mobileSyncSchema.parse(body);
    const sql = await getSql();
    let accepted = 0;
    let duplicated = 0;

    for (const item of data.events) {
      assertMobilePayloadSize(item.payload);
      const result = await sql.query<{ id: number }>(
        `insert into mobile_telemetry_events (device_id, client_event_id, event_type, occurred_at, payload)
         values ($1,$2,$3,$4,$5::jsonb)
         on conflict (device_id, client_event_id) do nothing
         returning id`,
        [device.id, item.clientEventId, item.eventType, item.occurredAt, JSON.stringify(item.payload ?? {})],
      );
      if (result.length) accepted += 1;
      else duplicated += 1;
    }

    await sql.query("update mobile_devices set last_seen_at = current_timestamp where id = $1", [device.id]);
    return { ok: true, apiVersion: 1, deviceId: device.id, accepted, duplicated, serverTime: new Date().toISOString() };
  }

  throw createError({ statusCode: 400, statusMessage: "عملیات همگام‌سازی نامعتبر است." });
});
