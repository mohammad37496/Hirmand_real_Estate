import {
  createError,
  defineEventHandler,
  getCookie,
  getQuery,
  setResponseHeader,
  type H3Event,
} from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionClaims,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit-log.server";

async function requireSecurityAdmin(event: H3Event) {
  const token = getCookie(event, ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw createError({ statusCode: 403, statusMessage: "مجوز پخش فایل تماس برای این حساب فعال نیست." });
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  await requireSecurityAdmin(event);

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده در دسترس نیست." });
  }

  const id = String(event.context.params?.id ?? "").trim();
  if (!id || id.length > 120) {
    throw createError({ statusCode: 400, statusMessage: "شناسه فایل تماس معتبر نیست." });
  }

  const download = String(getQuery(event).download ?? "0") === "1";
  const sql = await getSql();
  const rows = await sql.query<{
    file_name: string;
    mime_type: string;
    content: Buffer;
    device_id: string;
    staff_id: string;
  }>(
    `select
       f.name as file_name,
       f.mime_type,
       f.content,
       r.device_id,
       r.staff_id
     from staff_mobile_call_recordings r
     join staff_mobile_files f on f.id=r.file_id
     join staff_mobile_devices d on d.device_id=r.device_id
     where r.id=$1 and d.status='active'
     limit 1`,
    [id],
  );

  const row = rows[0];
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "فایل ضبط تماس پیدا نشد یا دستگاه فعال نیست." });
  }

  await writeAdminAuditLog({
    action: download
      ? "staff_mobile_call_recording.downloaded"
      : "staff_mobile_call_recording.played",
    entityType: "staff_mobile_call_recording",
    entityId: id,
    entityTitle: row.file_name,
    actor: "admin",
    metadata: {
      deviceId: row.device_id,
      staffId: row.staff_id,
      download,
    },
  });

  setResponseHeader(event, "content-type", row.mime_type || "audio/mp4");
  setResponseHeader(event, "content-length", String(row.content.length));
  setResponseHeader(event, "x-content-type-options", "nosniff");
  setResponseHeader(
    event,
    "content-disposition",
    (download ? "attachment" : "inline") +
      '; filename="' +
      encodeURIComponent(row.file_name || "hirmand-call-recording.m4a") +
      '"',
  );

  return row.content;
});
