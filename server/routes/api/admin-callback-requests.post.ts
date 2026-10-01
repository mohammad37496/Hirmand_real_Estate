import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const schema = z.object({
  action: z.enum(["list","status","note"]).default("list"),
  id: z.string().trim().max(120).optional(),
  status: z.enum(["new","contacted","scheduled","completed","cancelled"]).optional(),
  note: z.string().trim().max(1500).optional(),
});

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "درخواست تماس نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, callbacks: [] };

  const sql = await getSql();
  if (parsed.data.action === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      "select id,name,phone,preferred_at,property_id,property_title,note,status,internal_note,created_at,updated_at from callback_requests order by case when status='new' then 0 when status='scheduled' then 1 else 2 end, coalesce(preferred_at,created_at) asc limit 100",
    );
    return {
      enabled: true,
      callbacks: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        phone: String(row.phone),
        preferredAt: row.preferred_at == null ? null : new Date(String(row.preferred_at)).toISOString(),
        propertyId: row.property_id == null ? null : String(row.property_id),
        propertyTitle: String(row.property_title ?? ""),
        note: String(row.note ?? ""),
        internalNote: String(row.internal_note ?? ""),
        status: String(row.status),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      })),
    };
  }

  if (!parsed.data.id) throw createError({ statusCode: 400, statusMessage: "شناسه درخواست تماس مشخص نیست." });

  if (parsed.data.action === "status") {
    await sql.query(
      "update callback_requests set status=$2,handled_at=case when $2 in ('completed','cancelled') then current_timestamp else handled_at end,updated_at=current_timestamp where id=$1",
      [parsed.data.id, parsed.data.status ?? "new"],
    );
    return { success: true };
  }

  await sql.query(
    "update callback_requests set internal_note=$2,updated_at=current_timestamp where id=$1",
    [parsed.data.id, parsed.data.note?.trim() ?? ""],
  );
  return { success: true };
});
