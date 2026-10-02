import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const STATUSES = new Set(["available","reserved","sold","rented","unavailable"]);

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  await requireAdmin(event);
  const body = (await readBody(event).catch(() => ({}))) as { action?: "list" | "update"; id?: string; availabilityStatus?: string };

  if (dbSource === "unconfigured") return { items: [] };

  const sql = await getSql();

  if (body.action === "update") {
    const id = String(body.id ?? "").trim();
    const status = String(body.availabilityStatus ?? "");
    if (!id || !STATUSES.has(status)) {
      throw createError({ statusCode: 400, statusMessage: "شناسه یا وضعیت فایل نامعتبر است." });
    }
    const rows = await sql.query<{ id: string }>(
      "update properties set availability_status=$1, updated_at=current_timestamp where id=$2 and status<>'archived' returning id",
      [status, id],
    );
    if (!rows[0]) throw createError({ statusCode: 404, statusMessage: "فایل پیدا نشد." });
    return { success: true, id, availabilityStatus: status };
  }

  const rows = await sql.query<Record<string, unknown>>(
    "select id,slug,title,neighborhood,transaction_type,availability_status,contact_name,updated_at from properties where status<>'archived' order by case availability_status when 'reserved' then 0 when 'available' then 1 else 2 end, updated_at desc limit 160",
  );
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      neighborhood: String(row.neighborhood ?? ""),
      transactionType: String(row.transaction_type ?? ""),
      availabilityStatus: STATUSES.has(String(row.availability_status)) ? String(row.availability_status) : "available",
      contactName: String(row.contact_name ?? ""),
      updatedAt: row.updated_at == null ? null : new Date(String(row.updated_at)).toISOString(),
    })),
  };
});
