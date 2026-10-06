import { createError, defineEventHandler, getCookie, getQuery, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionClaims,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireSecurityAdmin(event: H3Event) {
  const token = getCookie(event, ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw createError({ statusCode: 403, statusMessage: "مجوز مشاهدهٔ تماس‌های سازمانی برای این حساب فعال نیست." });
  }
}

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isoFromEpochMs(value: unknown): string | null {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapCallType(raw: unknown): "incoming" | "outgoing" | "missed" | "rejected" | "blocked" | "other" {
  switch (Number(raw)) {
    case 1: return "incoming";
    case 2: return "outgoing";
    case 3: return "missed";
    case 5: return "rejected";
    case 6: return "blocked";
    default: return "other";
  }
}

function directionLabel(direction: string) {
  switch (direction) {
    case "incoming": return "دریافتی";
    case "outgoing": return "گرفته‌شده";
    case "missed": return "بی‌پاسخ";
    case "rejected": return "ردشده";
    case "blocked": return "مسدودشده";
    default: return "سایر";
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  await requireSecurityAdmin(event);

  if (dbSource === "unconfigured") {
    return { success: true, calls: [], recordings: [], generatedAt: new Date().toISOString() };
  }

  const query = getQuery(event);
  const requestedLimit = Number(query.limit ?? 500);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 500)) : 500;
  const deviceId = clean(query.deviceId, 120);

  const sql = await getSql();

  const calls = await sql.query<Record<string, unknown>>(
    `select
       s.device_id,
       coalesce(d.name,'گوشی ناشناس') as device_name,
       c->>'number' as phone_number,
       c->>'type' as call_type,
       c->>'date' as date_ms,
       c->>'durationSeconds' as duration_seconds
     from phone_bridge_snapshots s
     join phone_bridge_devices d on d.id=s.device_id
     cross join lateral jsonb_array_elements(
       case
         when jsonb_typeof(s.payload->'calls') = 'array' then s.payload->'calls'
         else '[]'::jsonb
       end
     ) c
     where d.enabled=true
       and ($1::text = '' or s.device_id=$1)
       and exists (
         select 1
         from phone_bridge_consents co
         where co.device_id=d.id
           and co.revoked_at is null
           and (
             co.scopes @> '{"contacts_calls_sms": true}'::jsonb
             or co.scopes @> '{"calls": true}'::jsonb
           )
       )
       and exists (
         select 1
         from phone_bridge_policies p
         where p.device_id=d.id
           and (
             p.modules @> '{"calls": true}'::jsonb
             or p.modules @> '{"contacts_calls_sms": true}'::jsonb
           )
       )
       and (
         c->>'date' ~ '^[0-9]+$'
       )
     order by (c->>'date')::bigint desc
     limit $2`,
    [deviceId, limit],
  );

  const recordings = await sql.query<Record<string, unknown>>(
    `select
       r.id,
       r.device_id,
       coalesce(d.name,'گوشی ناشناس') as device_name,
       r.call_started_at,
       r.call_ended_at,
       r.direction,
       r.phone_number,
       r.contact_name,
       r.duration_seconds,
       r.mime_type,
       r.size_bytes
     from phone_bridge_call_recordings r
     join phone_bridge_devices d on d.id=r.device_id
     where d.enabled=true
       and ($1::text = '' or r.device_id=$1)
       and exists (
         select 1
         from phone_bridge_consents co
         where co.device_id=d.id
           and co.revoked_at is null
           and co.scopes @> '{"call_recording": true}'::jsonb
       )
       and exists (
         select 1
         from phone_bridge_policies p
         where p.device_id=d.id
           and p.modules @> '{"call_recording": true}'::jsonb
       )
     order by r.call_started_at desc
     limit $2`,
    [deviceId, limit],
  );

  const mappedCalls = calls
    .map((row) => {
      const direction = mapCallType(row.call_type);
      return {
        id: `call:${String(row.device_id)}:${String(row.date_ms)}:${String(row.phone_number ?? "")}:${String(row.call_type)}`,
        deviceId: String(row.device_id),
        deviceName: String(row.device_name ?? "گوشی ناشناس"),
        phoneNumber: row.phone_number ? String(row.phone_number) : null,
        direction,
        directionLabel: directionLabel(direction),
        occurredAt: isoFromEpochMs(row.date_ms),
        durationSeconds: row.duration_seconds == null ? null : Math.max(0, Number(row.duration_seconds)),
      };
    })
    .filter((row) => row.occurredAt);

  const mappedRecordings = recordings.map((row) => ({
    id: String(row.id),
    deviceId: String(row.device_id),
    deviceName: String(row.device_name ?? "گوشی ناشناس"),
    callStartedAt: row.call_started_at ? new Date(String(row.call_started_at)).toISOString() : null,
    callEndedAt: row.call_ended_at ? new Date(String(row.call_ended_at)).toISOString() : null,
    direction: ["incoming", "outgoing", "unknown"].includes(String(row.direction))
      ? String(row.direction)
      : "unknown",
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    mimeType: String(row.mime_type ?? "audio/mp4"),
    sizeBytes: Number(row.size_bytes ?? 0),
    streamUrl: `/api/admin/phone-bridge/call-recordings/${encodeURIComponent(String(row.id))}`,
    downloadUrl: `/api/admin/phone-bridge/call-recordings/${encodeURIComponent(String(row.id))}?download=1`,
  }));

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    calls: mappedCalls,
    recordings: mappedRecordings,
    counts: {
      calls: mappedCalls.length,
      recordings: mappedRecordings.length,
      incoming: mappedCalls.filter((item) => item.direction === "incoming").length,
      outgoing: mappedCalls.filter((item) => item.direction === "outgoing").length,
      missed: mappedCalls.filter((item) => item.direction === "missed").length,
    },
  };
});
