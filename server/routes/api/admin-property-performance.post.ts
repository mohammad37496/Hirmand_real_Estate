import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { dbSource, getSql } from "@/lib/db";
import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";

const EVENT_NAMES = [
  "property_view",
  "property_favorite",
  "property_share",
  "property_compare",
  "call_click",
  "whatsapp_click",
  "property_price_watch",
  "visit_request",
  "visit_request_click",
] as const;

type EventName = typeof EVENT_NAMES[number];

function emptyStats() {
  return Object.fromEntries(EVENT_NAMES.map((event) => [event, 0])) as Record<EventName, number>;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نیاز به ورود مدیریت دارید." });
  }

  await assertSameOrigin(event);

  const body = (await readBody(event).catch(() => ({}))) as { propertyId?: unknown };
  const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim().slice(0, 120) : "";
  if (!propertyId) {
    throw createError({ statusCode: 400, statusMessage: "شناسه فایل الزامی است." });
  }
  if (dbSource === "unconfigured") {
    return {
      windowDays: 30,
      property: null,
      events: emptyStats(),
      uniqueVisitors: 0,
      leads: { total: 0, visitRequests: 0, confirmedVisits: 0, completedVisits: 0 },
      conversionRate: 0,
    };
  }

  const sql = await getSql();
  const propertyRows = await sql.query<{
    id: string;
    slug: string;
    title: string;
    status: string;
    availability_status: string;
  }>(
    "select id::text as id, slug, title, status, availability_status from properties where id::text = $1 limit 1",
    [propertyId],
  );
  const property = propertyRows[0];
  if (!property) {
    throw createError({ statusCode: 404, statusMessage: "فایل موردنظر پیدا نشد." });
  }

  const [eventRows, leadRows] = await Promise.all([
    sql.query<{ event_name: string; count: number; unique_visitors: number }>(
      "select event_name, count(*)::int as count, count(distinct visitor_id)::int as unique_visitors " +
        "from site_events " +
        "where property_slug = $1 and day >= (current_timestamp at time zone 'Asia/Tehran')::date - 29 " +
        "group by event_name",
      [property.slug],
    ),
    sql.query<{
      total: number;
      visit_requests: number;
      confirmed_visits: number;
      completed_visits: number;
    }>(
      "select " +
        "count(*)::int as total, " +
        "count(*) filter (where visit_status = 'requested')::int as visit_requests, " +
        "count(*) filter (where visit_status = 'confirmed')::int as confirmed_visits, " +
        "count(*) filter (where visit_status = 'completed')::int as completed_visits " +
        "from leads where property_id = $1 and created_at >= current_timestamp - interval '30 days'",
      [property.id],
    ),
  ]);

  const events = emptyStats();
  let uniqueVisitors = 0;
  for (const row of eventRows) {
    if (EVENT_NAMES.includes(row.event_name as EventName)) {
      events[row.event_name as EventName] = Number(row.count) || 0;
      uniqueVisitors = Math.max(uniqueVisitors, Number(row.unique_visitors) || 0);
    }
  }

  const leads = leadRows[0] ?? {
    total: 0,
    visit_requests: 0,
    confirmed_visits: 0,
    completed_visits: 0,
  };
  const viewCount = events.property_view;
  const conversionRate = viewCount > 0 ? Math.min(100, Math.round((Number(leads.total) / viewCount) * 1000) / 10) : 0;

  return {
    windowDays: 30,
    property: {
      id: property.id,
      slug: property.slug,
      title: property.title,
      status: property.status,
      availabilityStatus: property.availability_status,
    },
    events,
    uniqueVisitors,
    leads: {
      total: Number(leads.total) || 0,
      visitRequests: Number(leads.visit_requests) || 0,
      confirmedVisits: Number(leads.confirmed_visits) || 0,
      completedVisits: Number(leads.completed_visits) || 0,
    },
    conversionRate,
  };
});
