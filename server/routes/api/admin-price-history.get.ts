import { createError, defineEventHandler, getCookie, getQuery, setResponseHeader, type H3Event } from "h3";
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
  if (dbSource === "unconfigured") return { items: [], summary: { changes: 0, drops: 0, increases: 0 } };

  const query = getQuery(event) as Record<string, unknown>;
  const days = Math.min(Math.max(Number(query.days) || 90, 7), 365);
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select h.id,h.property_id,h.changed_at,p.slug,p.title,p.neighborhood,p.transaction_type," +
    "h.before_state->>'price' as before_price,h.after_state->>'price' as after_price," +
    "h.before_state->>'deposit' as before_deposit,h.after_state->>'deposit' as after_deposit," +
    "h.before_state->>'rent' as before_rent,h.after_state->>'rent' as after_rent " +
    "from property_change_history h join properties p on p.id::text=h.property_id::text " +
    "where h.action='updated' and h.changed_at >= current_timestamp - ($1 * interval '1 day') and (" +
    "coalesce(h.before_state->>'price','') <> coalesce(h.after_state->>'price','') or " +
    "coalesce(h.before_state->>'deposit','') <> coalesce(h.after_state->>'deposit','') or " +
    "coalesce(h.before_state->>'rent','') <> coalesce(h.after_state->>'rent','')) " +
    "order by h.changed_at desc,h.id desc limit 180",
    [days],
  );

  const items = rows.map((row) => {
    const tx = String(row.transaction_type ?? "");
    const oldValue = tx === "rent" ? Number(row.before_rent ?? row.before_deposit ?? 0) : tx === "mortgage" ? Number(row.before_deposit ?? 0) : Number(row.before_price ?? 0);
    const newValue = tx === "rent" ? Number(row.after_rent ?? row.after_deposit ?? 0) : tx === "mortgage" ? Number(row.after_deposit ?? 0) : Number(row.after_price ?? 0);
    const percent = oldValue > 0 && newValue > 0 ? Number((((newValue - oldValue) / oldValue) * 100).toFixed(2)) : null;
    return {
      id: String(row.id),
      propertyId: String(row.property_id),
      slug: String(row.slug),
      title: String(row.title ?? "فایل"),
      neighborhood: String(row.neighborhood ?? ""),
      transactionType: tx,
      changedAt: new Date(String(row.changed_at)).toISOString(),
      oldValue: Number.isFinite(oldValue) ? oldValue : null,
      newValue: Number.isFinite(newValue) ? newValue : null,
      deltaPercent: percent,
      direction: percent == null || percent === 0 ? "same" : percent < 0 ? "down" : "up",
    };
  }).filter((item) => item.oldValue != null && item.newValue != null && item.oldValue !== item.newValue);

  return {
    items,
    summary: {
      changes: items.length,
      drops: items.filter((item) => item.direction === "down").length,
      increases: items.filter((item) => item.direction === "up").length,
    },
  };
});
