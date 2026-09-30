import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const ALLOWED_DAYS = new Set([7, 30, 90]);

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertSameOrigin(event);
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید." });
  }

  const body = (await readBody(event).catch(() => ({}))) as { days?: unknown };
  const candidate = Number(body?.days);
  const days = ALLOWED_DAYS.has(candidate) ? candidate : 30;

  if (dbSource === "unconfigured") {
    return { days, rows: [], totals: { campaigns: 0, leads: 0, contacted: 0, visits: 0, contracts: 0 } };
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select
       coalesce(nullif(trim(acquisition_source), ''), nullif(trim(source), ''), 'direct') as source,
       coalesce(nullif(trim(acquisition_medium), ''), '—') as medium,
       coalesce(nullif(trim(acquisition_campaign), ''), 'بدون کمپین') as campaign,
       count(*)::int as leads,
       count(*) filter (where status <> 'new')::int as contacted,
       count(*) filter (where visit_requested_at is not null or visit_status = 'requested' or status = 'visited')::int as visits,
       count(*) filter (where status = 'contract')::int as contracts
     from leads
     where created_at >= current_timestamp - interval '${days} days'
     group by 1,2,3
     order by contracts desc, visits desc, leads desc, source asc, campaign asc
     limit 50
    `,
  ).catch((error) => {
    console.error("[admin-campaign-performance] query unavailable", error);
    return [];
  });

  const mapped = rows.map((row) => {
    const leads = Number(row.leads) || 0;
    const contacted = Number(row.contacted) || 0;
    const visits = Number(row.visits) || 0;
    const contracts = Number(row.contracts) || 0;
    return {
      source: String(row.source ?? "direct"),
      medium: String(row.medium ?? "—"),
      campaign: String(row.campaign ?? "بدون کمپین"),
      leads, contacted, visits, contracts,
      contactRate: leads ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      contractRate: leads ? Number(((contracts / leads) * 100).toFixed(1)) : 0,
    };
  });

  const totals = mapped.reduce((acc, row) => ({
    campaigns: acc.campaigns + 1,
    leads: acc.leads + row.leads,
    contacted: acc.contacted + row.contacted,
    visits: acc.visits + row.visits,
    contracts: acc.contracts + row.contracts,
  }), { campaigns: 0, leads: 0, contacted: 0, visits: 0, contracts: 0 });

  return { days, rows: mapped, totals };
});
