import {
  createError,
  defineEventHandler,
  getCookie,
  readBody,
  setCookie,
} from "h3";
import { dbSource, getSql } from "@/lib/db";

const COOKIE_NAME = "hirmand_visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function validVisitorId(value: string | undefined) {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}

export default defineEventHandler(async (event) => {
  if (dbSource === "unconfigured") return { ok: true, tracked: false };

  const body = (await readBody(event)) as { path?: unknown };
  const path = typeof body.path === "string" ? body.path.trim() : "";

  if (!path.startsWith("/") || path.startsWith("/api/") || path.startsWith("/admin")) {
    throw createError({ statusCode: 400, statusMessage: "مسیر بازدید نامعتبر است." });
  }

  let visitorId = getCookie(event, COOKIE_NAME);
  if (!validVisitorId(visitorId)) {
    visitorId = crypto.randomUUID();
    setCookie(event, COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  const sql = await getSql();
  await sql.query(
    "insert into site_visitor_days " +
      "(day, visitor_id, pageviews, first_path, last_path, first_seen_at, last_seen_at) " +
      "values ((current_timestamp at time zone $$Asia/Tehran$$)::date, $1, 1, $2, $2, current_timestamp, current_timestamp) " +
      "on conflict (day, visitor_id) do update set " +
      "pageviews = site_visitor_days.pageviews + 1, " +
      "last_path = excluded.last_path, last_seen_at = current_timestamp",
    [visitorId, path.slice(0, 500)],
  );

  return { ok: true, tracked: true };
});
