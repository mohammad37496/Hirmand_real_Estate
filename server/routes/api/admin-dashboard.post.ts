import { createError, defineEventHandler, readBody } from "h3";
import { dbSource, getSql } from "@/lib/db";

type LeadStatus = "new" | "contacted" | "closed" | "spam";

function requireAdmin(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey.trim() !== expected) {
    throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { adminKey?: string };
  requireAdmin(body.adminKey);

  if (dbSource === "unconfigured") {
    return {
      properties: { total: 0, published: 0, draft: 0, archived: 0, featured: 0 },
      leads: { total: 0, new: 0, contacted: 0, closed: 0, spam: 0, today: 0, last7: 0, last30: 0 },
      propertyTypes: [],
      leadDays: [],
      music: { total: 0, active: 0 },
      visitors: { today: 0, last7: 0, last30: 0, pageviewsToday: 0, pageviewsLast7: 0, pageviewsLast30: 0 },
      visitorDays: [],
      topPages: [],
      eventStats: [],
      recentLeads: [],
    };
  }

  const sql = await getSql();
  const [propertyStats, leadStats, propertyTypes, leadDays, musicStats, recentLeads, visitorStats, visitorDays, topPages, eventStats] = await Promise.all([
    sql.query<Record<string, unknown>>(`
      select
        count(*)::int as total,
        count(*) filter (where status = 'published')::int as published,
        count(*) filter (where status = 'draft')::int as draft,
        count(*) filter (where status = 'archived')::int as archived,
        count(*) filter (where featured = true)::int as featured
      from properties
    `),
    sql.query<Record<string, unknown>>(`
      select
        count(*)::int as total,
        count(*) filter (where status = 'new')::int as new,
        count(*) filter (where status = 'contacted')::int as contacted,
        count(*) filter (where status = 'closed')::int as closed,
        count(*) filter (where status = 'spam')::int as spam,
        count(*) filter (where created_at >= current_date)::int as today,
        count(*) filter (where created_at >= current_timestamp - interval '7 days')::int as last7,
        count(*) filter (where created_at >= current_timestamp - interval '30 days')::int as last30
      from leads
    `),
    sql.query<Record<string, unknown>>(`
      select property_type, count(*)::int as count
      from properties
      group by property_type
      order by count desc
    `),
    sql.query<Record<string, unknown>>(`
      select created_at::date as day, count(*)::int as count
      from leads
      where created_at >= current_date - interval '6 days'
      group by created_at::date
      order by day asc
    `),
    sql.query<Record<string, unknown>>(`
      select count(*)::int as total, count(*) filter (where active = true)::int as active
      from music_tracks
    `),
    sql.query<Record<string, unknown>>(`
      select id, name, phone, deal, neighborhood, status, created_at
      from leads
      order by created_at desc
      limit 6
    `),
    sql.query<Record<string, unknown>>(`
      select
        count(*) filter (
          where day = (current_timestamp at time zone 'Asia/Tehran')::date
        )::int as today,
        count(distinct visitor_id) filter (
          where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 6
        )::int as last7,
        count(distinct visitor_id) filter (
          where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 29
        )::int as last30,
        coalesce(sum(pageviews) filter (
          where day = (current_timestamp at time zone 'Asia/Tehran')::date
        ), 0)::int as pageviews_today,
        coalesce(sum(pageviews) filter (
          where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 6
        ), 0)::int as pageviews_last7,
        coalesce(sum(pageviews) filter (
          where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 29
        ), 0)::int as pageviews_last30
      from site_visitor_days
    `).catch((error) => {
      console.error("[admin-dashboard] visitor stats unavailable", error);
      return [{}];
    }),
    sql.query<Record<string, unknown>>(`
      select
        ((current_timestamp at time zone 'Asia/Tehran')::date - days.n)::date as day,
        count(site_visitor_days.visitor_id)::int as unique_visitors,
        coalesce(sum(site_visitor_days.pageviews), 0)::int as pageviews
      from generate_series(0, 13) as days(n)
      left join site_visitor_days
        on site_visitor_days.day = ((current_timestamp at time zone 'Asia/Tehran')::date - days.n)
      group by days.n
      order by day asc
    `).catch((error) => {
      console.error("[admin-dashboard] visitor trend unavailable", error);
      return [];
    }),
    sql.query<Record<string, unknown>>(`
      select
        path,
        coalesce(sum(pageviews), 0)::int as pageviews,
        count(distinct visitor_id)::int as unique_visitors
      from site_page_days
      where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 29
        and path not like '/api/%'
        and path not like '/admin%'
      group by path
      order by pageviews desc, unique_visitors desc
      limit 8
    `).catch((error) => {
      console.error("[admin-dashboard] top pages unavailable", error);
      return [];
    }),
    sql.query<Record<string, unknown>>(`
      select
        event_name,
        count(*)::int as count
      from site_events
      where day >= (current_timestamp at time zone 'Asia/Tehran')::date - 29
      group by event_name
      order by count desc
    `).catch((error) => {
      console.error("[admin-dashboard] event stats unavailable", error);
      return [];
    }),
  ]);
  const p = propertyStats[0] ?? {};
  const l = leadStats[0] ?? {};
  const m = musicStats[0] ?? {};
  const v = (visitorStats[0] ?? {}) as Record<string, unknown>;

  return {
    properties: {
      total: Number(p.total) || 0,
      published: Number(p.published) || 0,
      draft: Number(p.draft) || 0,
      archived: Number(p.archived) || 0,
      featured: Number(p.featured) || 0,
    },
    leads: {
      total: Number(l.total) || 0,
      new: Number(l.new) || 0,
      contacted: Number(l.contacted) || 0,
      closed: Number(l.closed) || 0,
      spam: Number(l.spam) || 0,
      today: Number(l.today) || 0,
      last7: Number(l.last7) || 0,
      last30: Number(l.last30) || 0,
    },
    propertyTypes: propertyTypes.map((row) => ({
      type: String(row.property_type ?? "other"),
      count: Number(row.count) || 0,
    })),
    leadDays: leadDays.map((row) => ({
      day: new Date(String(row.day)).toISOString().slice(0, 10),
      count: Number(row.count) || 0,
    })),
    music: {
      total: Number(m.total) || 0,
      active: Number(m.active) || 0,
    },
    visitors: {
      today: Number(v.today) || 0,
      last7: Number(v.last7) || 0,
      last30: Number(v.last30) || 0,
      pageviewsToday: Number(v.pageviews_today) || 0,
      pageviewsLast7: Number(v.pageviews_last7) || 0,
      pageviewsLast30: Number(v.pageviews_last30) || 0,
    },
    visitorDays: visitorDays.map((row) => ({
      day: String(row.day).slice(0, 10),
      uniqueVisitors: Number(row.unique_visitors) || 0,
      pageviews: Number(row.pageviews) || 0,
    })),
    topPages: topPages.map((row) => ({
      path: String(row.path),
      pageviews: Number(row.pageviews) || 0,
      uniqueVisitors: Number(row.unique_visitors) || 0,
    })),
    eventStats: eventStats.map((row) => ({
      event: String(row.event_name),
      count: Number(row.count) || 0,
    })),
    recentLeads: recentLeads.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      phone: String(row.phone),
      deal: String(row.deal),
      neighborhood: String(row.neighborhood ?? ""),
      status: String(row.status) as LeadStatus,
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
  };
});
