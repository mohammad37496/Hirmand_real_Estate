import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";

const TIMES = Array.from({ length: 23 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}).filter((time) => time <= "20:00");

function toIranDate(date: string, time: string) {
  return new Date(date + "T" + time + ":00+03:30");
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value + "T12:00:00+03:30").getTime());
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const query = getQuery(event);
  const propertyId = typeof query.propertyId === "string" ? query.propertyId.trim().slice(0, 120) : "";
  const date = typeof query.date === "string" ? query.date.trim() : "";

  if (!propertyId || !isValidDate(date)) {
    throw createError({ statusCode: 400, statusMessage: "فایل یا تاریخ بازدید نامعتبر است." });
  }
  if (dbSource === "unconfigured") {
    return { enabled: false, durationMinutes: 60, slots: TIMES.map((time) => ({ time, available: true })) };
  }

  const sql = await getSql();
  const propertyRows = await sql.query<{ availability_status: string }>(
    "select availability_status from properties where id::text=$1 and status='published' limit 1",
    [propertyId],
  );
  const property = propertyRows[0];
  if (!property) throw createError({ statusCode: 404, statusMessage: "فایل موردنظر پیدا نشد." });
  if (property.availability_status !== "available" && property.availability_status !== "reserved") {
    return { enabled: true, durationMinutes: 60, slots: TIMES.map((time) => ({ time, available: false })) };
  }

  const dayStart = toIranDate(date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const rows = await sql.query<{ visit_preferred_at: string | Date }>(
    `select visit_preferred_at
     from leads
     where property_id::text=$1
       and visit_status in ('requested','confirmed')
       and visit_preferred_at is not null
       and visit_preferred_at >= $2::timestamptz
       and visit_preferred_at < $3::timestamptz
     order by visit_preferred_at asc`,
    [propertyId, dayStart.toISOString(), dayEnd.toISOString()],
  );

  const busy = rows.map((row) => new Date(String(row.visit_preferred_at)).getTime()).filter(Number.isFinite);
  const slots = TIMES.map((time) => {
    const slot = toIranDate(date, time).getTime();
    const available = !busy.some((existing) => Math.abs(existing - slot) < 60 * 60 * 1000);
    return { time, available };
  });

  return { enabled: true, durationMinutes: 60, slots };
});
