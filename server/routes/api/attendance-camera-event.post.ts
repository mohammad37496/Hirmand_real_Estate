import { randomUUID } from "node:crypto";
import { createError, defineEventHandler, readRawBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { requireSignedAttendanceCameraRequest } from "@/lib/attendance-camera-signature.server";

const MAX_BODY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;
type AttendanceSession = { clockIn: string; clockOut: string };

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function stringValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function parseSessions(value: unknown): AttendanceSession[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 12).flatMap((item) => {
    const row = object(item);
    if (typeof row.clockIn !== "string") return [];
    return [{ clockIn: row.clockIn.slice(0, 5), clockOut: typeof row.clockOut === "string" ? row.clockOut.slice(0, 5) : "" }];
  });
}
function localDateTime(date: Date) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (key: string) => dateParts.find((part) => part.type === key)?.value ?? "";
  const workDate = value("year") + "-" + value("month") + "-" + value("day");
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
  return { workDate, clock };
}
function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}
function thresholdFromEnv() {
  const raw = Number.parseFloat(process.env.ATTENDANCE_CAMERA_MIN_MATCH_SCORE ?? "0.48");
  return Number.isFinite(raw) && raw >= 0.3 && raw <= 0.99 ? raw : 0.48;
}
async function setEventStatus(
  sql: Awaited<ReturnType<typeof getSql>>,
  eventId: string,
  status: "applied" | "duplicate" | "needs_review",
  note: string,
) {
  await sql.query(
    `update staff_attendance_camera_events
     set status=$2, result_note=$3, processed_at=current_timestamp
     where event_id=$1`,
    [eventId, status, note.slice(0, 500)],
  );
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای ثبت دوربین آماده نیست." });
  }

  const raw = await readRawBody(event);
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw ?? "");
  if (!body.length || body.length > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "بدنه رویداد دوربین خالی یا بیش از حد بزرگ است." });
  }
  await requireSignedAttendanceCameraRequest(event, body);

  let payload: JsonObject;
  try { payload = object(JSON.parse(body.toString("utf8"))); }
  catch { throw createError({ statusCode: 400, statusMessage: "داده رویداد دوربین JSON معتبر نیست." }); }

  const eventId = stringValue(payload.eventId, 80);
  const consultantId = stringValue(payload.consultantId, 80);
  const direction = stringValue(payload.direction, 10);
  const cameraId = stringValue(payload.cameraId, 80);
  const occurredAtText = stringValue(payload.occurredAt, 80);
  const matchScore = typeof payload.matchScore === "number" && Number.isFinite(payload.matchScore) ? payload.matchScore : NaN;

  if (!UUID_PATTERN.test(eventId) || !/^[A-Za-z0-9._:-]{2,80}$/.test(consultantId)) {
    throw createError({ statusCode: 422, statusMessage: "شناسه رویداد یا کارمند معتبر نیست." });
  }
  if (direction !== "entry" && direction !== "exit") {
    throw createError({ statusCode: 422, statusMessage: "جهت عبور باید entry یا exit باشد." });
  }
  if (!/^[A-Za-z0-9._:-]{2,80}$/.test(cameraId)) {
    throw createError({ statusCode: 422, statusMessage: "شناسه دوربین معتبر نیست." });
  }
  if (!(matchScore >= 0 && matchScore <= 1)) {
    throw createError({ statusCode: 422, statusMessage: "امتیاز تطبیق چهره باید بین صفر و یک باشد." });
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(occurredAtText)) {
    throw createError({ statusCode: 422, statusMessage: "زمان رویداد باید شامل منطقه زمانی باشد." });
  }
  const occurredAt = new Date(occurredAtText);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw createError({ statusCode: 422, statusMessage: "زمان رویداد معتبر نیست." });
  }
  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000 ||
      occurredAt.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) {
    throw createError({ statusCode: 422, statusMessage: "زمان رویداد بیش از حد قدیمی یا در آینده است." });
  }

  const sql = await getSql();
  const staffRows = await sql.query<{ id: string; name: string; is_active: boolean }>(
    "select id,name,is_active from consultants where id=$1 limit 1",
    [consultantId],
  );
  const staff = staffRows[0];
  if (!staff || !staff.is_active) {
    throw createError({ statusCode: 422, statusMessage: "کارمند در فهرست فعال مشاوران هیرمند پیدا نشد." });
  }

  const local = localDateTime(occurredAt);
  const eventInsert = await sql.query<{ event_id: string }>(
    `insert into staff_attendance_camera_events
      (event_id,consultant_id,direction,occurred_at,camera_id,match_score,status)
     values ($1,$2,$3,$4::timestamptz,$5,$6,'received')
     on conflict (event_id) do nothing
     returning event_id`,
    [eventId, consultantId, direction, occurredAt.toISOString(), cameraId, matchScore],
  );
  if (eventInsert.length === 0) {
    const prior = await sql.query<{ status: string; result_note: string }>(
      "select status,result_note from staff_attendance_camera_events where event_id=$1 limit 1",
      [eventId],
    );
    return { ok: true, accepted: false, status: prior[0]?.status ?? "duplicate", note: prior[0]?.result_note ?? "" };
  }

  if (matchScore < thresholdFromEnv()) {
    await setEventStatus(sql, eventId, "needs_review", "امتیاز تطبیق پایین‌تر از حد مجاز است؛ ثبت حضور انجام نشد.");
    return { ok: true, accepted: true, status: "needs_review" };
  }

  const nearby = await sql.query<{ event_id: string }>(
    `select event_id from staff_attendance_camera_events
     where consultant_id=$1 and direction=$2 and status='applied' and event_id<>$3
       and occurred_at between $4::timestamptz - interval '45 seconds'
                           and $4::timestamptz + interval '45 seconds'
     limit 1`,
    [consultantId, direction, eventId, occurredAt.toISOString()],
  );
  if (nearby.length) {
    await setEventStatus(sql, eventId, "duplicate", "رویداد مشابه از دوربین دیگر در بازه کوتاه ثبت شده است.");
    return { ok: true, accepted: true, status: "duplicate" };
  }

  try {
    const attendanceRows = await sql.query<{ id: string; sessions: unknown; note: string }>(
      `select id,sessions,note from staff_attendance
       where consultant_id=$1 and work_date=$2::date limit 1`,
      [consultantId, local.workDate],
    );
    const existing = attendanceRows[0];
    const sessions = parseSessions(existing?.sessions ?? []);
    const openIndex = sessions.map((session, index) => session.clockOut === "" ? index : -1)
      .filter((index) => index >= 0).at(-1) ?? -1;

    if (direction === "entry") {
      if (openIndex >= 0) {
        await setEventStatus(sql, eventId, "needs_review", "یک نوبت قبلی هنوز ساعت خروج ندارد؛ ورود تازه خودکار ثبت نشد.");
        return { ok: true, accepted: true, status: "needs_review" };
      }
      sessions.push({ clockIn: local.clock, clockOut: "" });
      if (!existing) {
        const inserted = await sql.query<{ id: string }>(
          `insert into staff_attendance
            (id,consultant_id,consultant_name,work_date,sessions,note,created_at,updated_at)
           values ($1,$2,$3,$4::date,$5::jsonb,'ثبت خودکار دوربین',current_timestamp,current_timestamp)
           on conflict (consultant_id,work_date) do nothing
           returning id`,
          [randomUUID(), consultantId, staff.name, local.workDate, JSON.stringify(sessions)],
        );
        if (!inserted.length) {
          await setEventStatus(sql, eventId, "needs_review", "رکورد حضور هم‌زمان تغییر کرده است؛ بررسی دستی لازم است.");
          return { ok: true, accepted: true, status: "needs_review" };
        }
      } else {
        await sql.query(
          `update staff_attendance set sessions=$2::jsonb,
             note=case when btrim(note)='' then 'ثبت خودکار دوربین' else note end,
             updated_at=current_timestamp where id=$1`,
          [existing.id, JSON.stringify(sessions)],
        );
      }
    } else {
      if (!existing || openIndex < 0) {
        await setEventStatus(sql, eventId, "needs_review", "ساعت ورود متناظر پیدا نشد؛ ساعت خروج نیازمند بررسی دستی است.");
        return { ok: true, accepted: true, status: "needs_review" };
      }
      if (minutes(local.clock) <= minutes(sessions[openIndex].clockIn)) {
        await setEventStatus(sql, eventId, "needs_review", "ساعت خروج پیش از ورود همان روز است؛ اصلاح دستی لازم است.");
        return { ok: true, accepted: true, status: "needs_review" };
      }
      sessions[openIndex] = { ...sessions[openIndex], clockOut: local.clock };
      await sql.query(
        `update staff_attendance set sessions=$2::jsonb,
           note=case when btrim(note)='' then 'ثبت خودکار دوربین' else note end,
           updated_at=current_timestamp where id=$1`,
        [existing.id, JSON.stringify(sessions)],
      );
    }

    await setEventStatus(sql, eventId, "applied", "رویداد در ساعات حضور و غیاب ثبت شد.");
    return { ok: true, accepted: true, status: "applied", eventId };
  } catch (error) {
    await setEventStatus(sql, eventId, "needs_review", "پردازش خودکار کامل نشد؛ بررسی دستی لازم است.").catch(() => undefined);
    throw createError({
      statusCode: 500,
      statusMessage: "پردازش رویداد دوربین کامل نشد؛ رویداد برای بررسی مدیر نگهداری شد.",
      cause: error,
    });
  }
});
