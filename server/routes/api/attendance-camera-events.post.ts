import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertSameOrigin(event);
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "برای تغییر وضعیت رویداد دوربین وارد پنل مدیریت شوید." });
  }
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده حضور و غیاب در دسترس نیست." });
  }

  const body = await readBody(event).catch(() => null) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "درخواست بررسی رویداد معتبر نیست." });
  }
  const data = body as Record<string, unknown>;
  const eventId = typeof data.eventId === "string" ? data.eventId.trim() : "";
  if (data.action !== "mark_reviewed" || !EVENT_ID_PATTERN.test(eventId)) {
    throw createError({ statusCode: 422, statusMessage: "شناسه یا عملیات بررسی رویداد معتبر نیست." });
  }

  const sql = await getSql();
  const updated = await sql.query<{ event_id: string }>(
    "update staff_attendance_camera_events " +
      "set status='reviewed', result_note='مدیر رویداد را بررسی کرد؛ ثبت یا اصلاح ساعت‌ها باید جداگانه کنترل شود.', processed_at=current_timestamp " +
      "where event_id=$1 and status in ('received','needs_review') returning event_id",
    [eventId],
  );
  if (updated.length === 0) {
    throw createError({ statusCode: 409, statusMessage: "این رویداد پیدا نشد یا قبلاً بررسی شده است." });
  }
  return { ok: true, eventId };
});
