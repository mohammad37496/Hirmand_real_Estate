import { createError, defineEventHandler, getCookie, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "برای مشاهده رویدادهای دوربین وارد پنل مدیریت شوید." });
  }
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده حضور و غیاب در دسترس نیست." });
  }

  const sql = await getSql();
  const [rows, counts] = await Promise.all([
    sql.query<{
      event_id: string; consultant_id: string; consultant_name: string; direction: string;
      occurred_at: string; camera_id: string; match_score: number; status: string; result_note: string;
    }>(
      "select e.event_id,e.consultant_id,coalesce(c.name,e.consultant_id) as consultant_name, " +
        "e.direction,e.occurred_at::text as occurred_at,e.camera_id,e.match_score,e.status,e.result_note " +
        "from staff_attendance_camera_events e left join consultants c on c.id=e.consultant_id " +
        "order by e.occurred_at desc limit 20",
    ),
    sql.query<{ count: number }>(
      "select count(*)::int as count from staff_attendance_camera_events where status in ('received','needs_review')",
    ),
  ]);

  const secret = process.env.ATTENDANCE_CAMERA_SHARED_SECRET?.trim() ?? "";
  return {
    configured: secret.length >= 32,
    needsReviewCount: Number(counts[0]?.count ?? 0),
    events: rows.map((row) => ({
      eventId: row.event_id,
      consultantId: row.consultant_id,
      consultantName: row.consultant_name,
      direction: row.direction,
      occurredAt: row.occurred_at,
      cameraId: row.camera_id,
      matchScore: Number(row.match_score),
      status: row.status,
      resultNote: row.result_note,
    })),
  };
});
