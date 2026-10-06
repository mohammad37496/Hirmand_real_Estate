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
    throw createError({ statusCode: 403, statusMessage: "مجوز مشاهده تماس‌های کارکنان برای این حساب فعال نیست." });
  }
}

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function label(direction: string) {
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
    return {
      success: true,
      calls: [],
      recordings: [],
      generatedAt: new Date().toISOString(),
      counts: { calls: 0, recordings: 0, incoming: 0, outgoing: 0, missed: 0 },
    };
  }

  const query = getQuery(event);
  const requestedLimit = Number(query.limit ?? 500);
  const limit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 500))
    : 500;
  const deviceId = clean(query.deviceId, 120);

  const sql = await getSql();

  const calls = await sql.query<Record<string, unknown>>(
    `select
       c.id,
       c.device_id,
       c.staff_id,
       coalesce(co.name, 'کارمند ناشناس') as staff_name,
       coalesce(d.model, '') as device_model,
       c.phone_number,
       c.contact_name,
       c.direction,
       c.occurred_at,
       c.duration_seconds
     from staff_mobile_calls c
     join staff_mobile_devices d on d.device_id=c.device_id
     left join consultants co on co.id=c.staff_id
     where d.status='active'
       and ($1::text = '' or c.device_id=$1)
     order by c.occurred_at desc
     limit $2`,
    [deviceId, limit],
  );

  const recordings = await sql.query<Record<string, unknown>>(
    `select
       r.id,
       r.device_id,
       r.staff_id,
       coalesce(co.name, 'کارمند ناشناس') as staff_name,
       r.call_started_at,
       r.call_ended_at,
       r.direction,
       r.phone_number,
       r.contact_name,
       r.duration_seconds,
       r.mime_type,
       r.size_bytes
     from staff_mobile_call_recordings r
     join staff_mobile_devices d on d.device_id=r.device_id
     left join consultants co on co.id=r.staff_id
     where d.status='active'
       and ($1::text = '' or r.device_id=$1)
     order by r.call_started_at desc
     limit $2`,
    [deviceId, limit],
  );

  const mappedCalls = calls.map((row) => {
    const currentDirection = String(row.direction ?? "other");
    return {
      id: String(row.id),
      deviceId: String(row.device_id),
      staffId: String(row.staff_id),
      staffName: String(row.staff_name ?? "کارمند ناشناس"),
      deviceName: String(row.device_model ?? "").trim() || "گوشی هیرمند",
      phoneNumber: row.phone_number ? String(row.phone_number) : null,
      contactName: row.contact_name ? String(row.contact_name) : null,
      direction: currentDirection,
      directionLabel: label(currentDirection),
      occurredAt: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
      durationSeconds: row.duration_seconds == null ? 0 : Number(row.duration_seconds),
    };
  });

  const mappedRecordings = recordings.map((row) => ({
    id: String(row.id),
    deviceId: String(row.device_id),
    staffId: String(row.staff_id),
    staffName: String(row.staff_name ?? "کارمند ناشناس"),
    deviceName: String(row.device_name ?? row.device_model ?? "").trim() || "گوشی هیرمند",
    callStartedAt: row.call_started_at ? new Date(String(row.call_started_at)).toISOString() : null,
    callEndedAt: row.call_ended_at ? new Date(String(row.call_ended_at)).toISOString() : null,
    direction: ["incoming", "outgoing", "unknown"].includes(String(row.direction))
      ? String(row.direction)
      : "unknown",
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    durationSeconds: row.duration_seconds == null ? 0 : Number(row.duration_seconds),
    mimeType: String(row.mime_type ?? "audio/mp4"),
    sizeBytes: Number(row.size_bytes ?? 0),
    streamUrl: `/api/admin/mobile-management/staff-call-recordings/${encodeURIComponent(String(row.id))}`,
    downloadUrl: `/api/admin/mobile-management/staff-call-recordings/${encodeURIComponent(String(row.id))}?download=1`,
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
