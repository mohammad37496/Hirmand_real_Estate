import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const DEALS = ["درخواست کارشناسی فنی","درخواست محتوای جدید","بررسی حقوقی معامله","درخواست تأیید اطلاعات فایل"];

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  await requireAdmin();
  const body = (await readBody(event).catch(() => ({}))) as { action?: "list" };
  if (dbSource === "unconfigured") return { items: [] };
  if (body.action && body.action !== "list") throw createError({ statusCode: 400, statusMessage: "عملیات نامعتبر است." });

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select l.id,l.name,l.phone,l.deal,l.neighborhood,l.property_id,l.status,l.created_at,l.follow_up_at,l.note,p.slug as property_slug,p.title as property_title from leads l left join properties p on p.id::text=l.property_id::text where l.deal = any($1::text[]) order by case l.status when 'new' then 0 when 'follow_up' then 1 when 'contacted' then 2 else 3 end,l.created_at asc limit 160",
    [DEALS],
  );
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "مشتری"),
      phone: String(row.phone ?? ""),
      deal: String(row.deal ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      propertyId: row.property_id == null ? null : String(row.property_id),
      propertySlug: row.property_slug == null ? null : String(row.property_slug),
      propertyTitle: row.property_title == null ? null : String(row.property_title),
      status: row.status === "contacted" || row.status === "follow_up" || row.status === "closed" ? row.status : "new",
      createdAt: new Date(String(row.created_at)).toISOString(),
      followUpAt: row.follow_up_at == null ? null : new Date(String(row.follow_up_at)).toISOString(),
      note: String(row.note ?? ""),
    })),
  };
});
