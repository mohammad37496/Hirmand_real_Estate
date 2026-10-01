import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertSameOrigin(event);
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  await readBody(event).catch(() => ({}));
  if (dbSource === "unconfigured") return { enabled: false, items: [] };

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select
       l.id::text as id,
       l.name,
       l.phone,
       l.visit_preferred_at,
       l.visit_status,
       l.consultant,
       p.title as property_title,
       p.slug as property_slug,
       p.neighborhood
     from leads l
     left join properties p on p.id::text=l.property_id::text
     where l.visit_status in ('requested','confirmed')
       and l.visit_preferred_at >= current_timestamp - interval '60 minutes'
       and l.visit_preferred_at < current_timestamp + interval '14 days'
     order by l.visit_preferred_at asc
     limit 250`,
  );

  return {
    enabled: true,
    items: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      phone: String(row.phone ?? ""),
      preferredAt: new Date(String(row.visit_preferred_at)).toISOString(),
      status: String(row.visit_status ?? "requested"),
      consultant: String(row.consultant ?? ""),
      propertyTitle: String(row.property_title ?? "فایل ملکی"),
      propertySlug: String(row.property_slug ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
    })),
  };
});
