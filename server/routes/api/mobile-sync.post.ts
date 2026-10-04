import { createError, defineEventHandler, getHeader, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  assertMobilePayloadSize,
  generateMobileAccessToken,
  hashMobileAccessToken,
  mobileRegistrationSchema,
  mobileSyncSchema,
  readBearerToken,
  safeTokenEquals,
} from "@/lib/mobile-ingest.server";

function requireBootstrapKey(event: H3Event): void {
  const configured = process.env.HIRMAND_MOBILE_BOOTSTRAP_KEY?.trim();
  if (!configured) {
    throw createError({
      statusCode: 503,
      statusMessage: "کلید ثبت اولیه دستگاه در سرور تنظیم نشده است.",
    });
  }

  const supplied = getHeader(event, "x-mobile-bootstrap-key")?.trim() ?? "";
  if (!supplied || !safeTokenEquals(supplied, configured)) {
    throw createError({
      statusCode: 401,
      statusMessage: "کلید ثبت اولیه دستگاه معتبر نیست.",
    });
  }
}

async function findDeviceByToken(token: string) {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    enabled: boolean;
  }>(
    "select id, enabled from mobile_devices where access_token_hash = $1 limit 1",
    [hashMobileAccessToken(token)],
  );

  const device = rows[0];
  if (!device) {
    throw createError({
      statusCode: 401,
      statusMessage: "توکن دستگاه معتبر نیست.",
    });
  }
  if (!device.enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: "این دستگاه از دسترسی به همگام‌سازی منع شده است.",
    });
  }
  return device;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({
      statusCode: 503,
      statusMessage: "پایگاه داده برای دریافت اطلاعات دستگاه تنظیم نشده است.",
    });
  }

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "register") {
    requireBootstrapKey(event);

    const data = mobileRegistrationSchema.parse(body);
    const accessToken = generateMobileAccessToken();
    const tokenHash = hashMobileAccessToken(accessToken);
    const metadata = data.metadata ?? {};

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
        data.deviceId,
        data.platform,
        data.appVersion,
        data.deviceModel,
        data.osVersion,
        data.deviceLabel,
        tokenHash,
        JSON.stringify(metadata),
      ],
    );

    return {
      ok: true,
      apiVersion: 1,
      deviceId: data.deviceId,
      accessToken,
      serverTime: new Date().toISOString(),
    };
  }

  if (action === "sync") {
    const token = readBearerToken(getHeader(event, "authorization"));
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "Authorization دستگاه ارسال نشده است.",
      });
    }

    const device = await findDeviceByToken(token);
    const data = mobileSyncSchema.parse(body);
    const sql = await getSql();

    let accepted = 0;
    let duplicated = 0;

    for (const item of data.events) {
      assertMobilePayloadSize(item.payload);
      const result = await sql.query<{ id: number }>(
        `insert into mobile_telemetry_events (
           device_id, client_event_id, event_type, occurred_at, payload
         )
         values ($1,$2,$3,$4,$5::jsonb)
         on conflict (device_id, client_event_id) do nothing
         returning id`,
        [
          device.id,
          item.clientEventId,
          item.eventType,
          item.occurredAt,
          JSON.stringify(item.payload ?? {}),
        ],
      );

      if (result.length) accepted += 1;
      else duplicated += 1;
    }

    await sql.query(
      "update mobile_devices set last_seen_at = current_timestamp where id = $1",
      [device.id],
    );

    return {
      ok: true,
      apiVersion: 1,
      deviceId: device.id,
      accepted,
      duplicated,
      serverTime: new Date().toISOString(),
    };
  }

  throw createError({
    statusCode: 400,
    statusMessage: "عملیات همگام‌سازی نامعتبر است.",
  });
});
