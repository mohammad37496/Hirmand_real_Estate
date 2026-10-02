import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  await requireAdmin(event);
  const body = (await readBody(event).catch(() => ({}))) as { days?: number; thresholdMinutes?: number };
  if (dbSource === "unconfigured") return { summary: { active: 0, waiting: 0, breached: 0, responded: 0, avgResponseMinutes: null }, leads: [], consultants: [] };

  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const threshold = Math.min(Math.max(Number(body.thresholdMinutes) || 120, 15), 1440);
  const sql = await getSql();

  const leads = await sql.query<Record<string, unknown>>(
    "select l.id,l.name,l.phone,l.consultant,l.deal,l.neighborhood,l.status,l.created_at,fc.created_at as first_contact_at," +
    "case when fc.created_at is null then null else round(extract(epoch from (fc.created_at-l.created_at))/60)::int end as response_minutes " +
    "from leads l left join lateral (select a.created_at from lead_activities a where a.lead_id=l.id and a.activity_type in ('call','whatsapp','visit') order by a.created_at asc limit 1) fc on true " +
    "where l.status in ('new','contacted','follow_up','visited','contract') and l.created_at >= current_timestamp - ($1 * interval '1 day') " +
    "order by case when fc.created_at is null and l.created_at <= current_timestamp - ($2 * interval '1 minute') then 0 when fc.created_at is null then 1 else 2 end,l.created_at asc limit 120",
    [days, threshold],
  );

  const consultants = await sql.query<Record<string, unknown>>(
    "select coalesce(nullif(trim(l.consultant),''),'بدون مشاور') as consultant,count(*)::int as active," +
    "count(fc.created_at)::int as responded,count(*) filter (where fc.created_at is null)::int as waiting," +
    "count(*) filter (where fc.created_at is null and l.created_at <= current_timestamp - ($1 * interval '1 minute'))::int as breached," +
    "round(avg(extract(epoch from (fc.created_at-l.created_at))/60))::int as avg_response_minutes " +
    "from leads l left join lateral (select a.created_at from lead_activities a where a.lead_id=l.id and a.activity_type in ('call','whatsapp','visit') order by a.created_at asc limit 1) fc on true " +
    "where l.status in ('new','contacted','follow_up','visited','contract') and l.created_at >= current_timestamp - ($2 * interval '1 day') " +
    "group by 1 order by breached desc,active desc,consultant limit 30",
    [threshold, days],
  );

  const serialized = leads.map((row) => {
    const responseMinutes = row.response_minutes == null ? null : Number(row.response_minutes);
    const createdAt = new Date(String(row.created_at));
    return {
      id: String(row.id),
      name: String(row.name ?? "مشتری"),
      phone: String(row.phone ?? ""),
      consultant: String(row.consultant ?? ""),
      deal: String(row.deal ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      status: String(row.status ?? ""),
      createdAt: createdAt.toISOString(),
      firstContactAt: row.first_contact_at == null ? null : new Date(String(row.first_contact_at)).toISOString(),
      responseMinutes: Number.isFinite(responseMinutes) ? responseMinutes : null,
      breached: row.first_contact_at == null && Date.now() - createdAt.getTime() >= threshold * 60000,
    };
  });

  const responded = serialized.filter((item) => item.responseMinutes != null);
  const waiting = serialized.filter((item) => item.firstContactAt == null);
  return {
    summary: {
      active: serialized.length,
      waiting: waiting.length,
      breached: waiting.filter((item) => item.breached).length,
      responded: responded.length,
      avgResponseMinutes: responded.length ? Math.round(responded.reduce((sum, item) => sum + (item.responseMinutes || 0), 0) / responded.length) : null,
    },
    leads: serialized,
    consultants: consultants.map((row) => ({
      consultant: String(row.consultant ?? "بدون مشاور"),
      active: Number(row.active) || 0,
      responded: Number(row.responded) || 0,
      waiting: Number(row.waiting) || 0,
      breached: Number(row.breached) || 0,
      avgResponseMinutes: row.avg_response_minutes == null ? null : Number(row.avg_response_minutes),
    })),
  };
});
