import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const VISITOR_COOKIE = "hirmand_visitor_id";

const publicSchema = z.object({
  propertyId: z.string().trim().min(1).max(120),
  propertySlug: z.string().trim().min(1).max(220),
  propertyTitle: z.string().trim().min(1).max(180),
  reportType: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).default(""),
});

const adminSchema = z.object({
  action: z.enum(["list", "updateStatus"]),
  id: z.coerce.number().int().positive().optional(),
  status: z.enum(["open", "resolved", "dismissed"]).optional(),
});

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = await readBody(event).catch(() => ({}));
  const action = String((body as { action?: unknown })?.action ?? "");
  const wantsAdmin = action === "list" || action === "updateStatus";

  if (!wantsAdmin) {
    if (dbSource === "unconfigured") {
      throw createError({ statusCode: 503, statusMessage: "پایگاه داده تنظیم نشده است." });
    }
    const parsed = publicSchema.safeParse(body);
    if (!parsed.success) {
      throw createError({ statusCode: 422, statusMessage: "اطلاعات گزارش نامعتبر است." });
    }
    const sql = await getSql();
    const visitorId = getCookie(event, VISITOR_COOKIE);
    await sql.query(
      "insert into property_reports(property_id,property_slug,property_title,report_type,note,visitor_id) values($1,$2,$3,$4,$5,$6)",
      [
        parsed.data.propertyId,
        parsed.data.propertySlug,
        parsed.data.propertyTitle,
        parsed.data.reportType,
        parsed.data.note,
        visitorId && /^[a-f0-9-]{20,80}$/i.test(visitorId) ? visitorId : null,
      ],
    );
    return { ok: true };
  }

  await requireAdmin(event);
  const parsed = adminSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: "درخواست مدیریت نامعتبر است." });
  }
  if (dbSource === "unconfigured") return { openCount: 0, reports: [] };
  const sql = await getSql();

  if (parsed.data.action === "updateStatus") {
    if (!parsed.data.id || !parsed.data.status) {
      throw createError({ statusCode: 400, statusMessage: "شناسه و وضعیت گزارش لازم است." });
    }
    await sql.query(
      "update property_reports set status=$2, resolved_at=case when $2 in ('resolved','dismissed') then coalesce(resolved_at,current_timestamp) else null end where id=$1",
      [parsed.data.id, parsed.data.status],
    );
  }

  const rows = await sql.query<Record<string, unknown>>(
    "select id::text as id, property_id, property_slug, property_title, report_type, note, status, created_at, resolved_at from property_reports order by case status when 'open' then 0 when 'resolved' then 1 else 2 end, created_at desc limit 60",
  );
  const openCount = rows.filter((row) => String(row.status) === "open").length;

  return {
    openCount,
    reports: rows.map((row) => ({
      id: String(row.id),
      propertyId: String(row.property_id),
      propertySlug: String(row.property_slug),
      propertyTitle: String(row.property_title),
      reportType: String(row.report_type),
      note: String(row.note ?? ""),
      status: String(row.status),
      createdAt: new Date(String(row.created_at)).toISOString(),
      resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    })),
  };
});
