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

const EVENT_NAMES = new Set([
  "call_click",
  "whatsapp_click",
  "inquiry_submit",
  "inquiry_click",
  "property_share",
  "property_favorite",
  "property_view",
]);

function validVisitorId(value: string | undefined) {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}

export default defineEventHandler(async (event) => {
  if (dbSource === "unconfigured") return { ok: true, tracked: false };

  const body = (await readBody(event)) as {
    path?: unknown;
    event?: unknown;
    propertySlug?: unknown;
  };

  const path = typeof body.path === "string" ? body.path.trim() : "";
  const eventName = typeof body.event === "string" ? body.event.trim() : "";
  const propertySlug =
    typeof body.propertySlug === "string" ? body.propertySlug.trim().slice(0, 220) : null;

  const isPageview = path.startsWith("/") && !path.startsWith("/api/") && !path.startsWith("/admin");
  const isEvent = !eventName || EVENT_NAMES.has(eventName);

  if (!isPageview || !isEvent) {
    throw createError({ statusCode: 400, statusMessage: "رویداد یا مسیر بازدید نامعتبر است." });
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
  const dayExpr = "(current_timestamp at time zone 'Asia/Tehran')::date";

  if (eventName) {
    await sql.query(
      "insert into site_events (id, day, visitor_id, event_name, path, property_slug) " +
        "values ($1, " + dayExpr + ", $2, $3, $4, $5)",
      [crypto.randomUUID(), visitorId, eventName, path.slice(0, 500), propertySlug],
    );
  } else {
    await Promise.all([
      sql.query(
        "insert into site_visitor_days " +
          "(day, visitor_id, pageviews, first_path, last_path, first_seen_at, last_seen_at) " +
          "values (" +
          dayExpr +
          ", $1, 1, $2, $2, current_timestamp, current_timestamp) " +
          "on conflict (day, visitor_id) do update set " +
          "pageviews = site_visitor_days.pageviews + 1, " +
          "last_path = excluded.last_path, last_seen_at = current_timestamp",
        [visitorId, path.slice(0, 500)],
      ),
      sql.query(
        "insert into site_page_days (day, visitor_id, path, pageviews, last_seen_at) " +
          "values (" +
          dayExpr +
          ", $1, $2, 1, current_timestamp) " +
          "on conflict (day, visitor_id, path) do update set " +
          "pageviews = site_page_days.pageviews + 1, " +
          "last_seen_at = current_timestamp",
        [visitorId, path.slice(0, 500)],
      ),
    ]);
  }

  return { ok: true, tracked: true };
});
