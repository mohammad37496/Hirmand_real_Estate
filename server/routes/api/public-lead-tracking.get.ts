import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";
type VisitStatus = "none" | "requested" | "confirmed" | "completed" | "cancelled";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "در انتظار تماس",
  contacted: "تماس گرفته شد",
  follow_up: "در حال پیگیری",
  visited: "بازدید انجام شد",
  contract: "قرارداد ثبت شد",
  closed: "پرونده بسته شد",
  spam: "نامعتبر",
};

const VISIT_LABEL: Record<VisitStatus, string> = {
  none: "بدون درخواست بازدید",
  requested: "درخواست بازدید ثبت شده",
  confirmed: "بازدید تأیید شده",
  completed: "بازدید انجام شده",
  cancelled: "بازدید لغو شده",
};

function normalizeCode(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/\s+/g, "")
    : "";
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const code = normalizeCode(getQuery(event).code);
  if (!/^HIR-[A-Z0-9]{2}-[A-F0-9]{12}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: "کد رهگیری نامعتبر است." });
  }

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "سامانه پیگیری موقتاً در دسترس نیست." });
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select l.public_tracking_token,l.status,l.created_at,l.updated_at,l.consultant,l.deal,l.property_type,l.neighborhood,l.visit_preferred_at,l.visit_status,p.title as property_title,p.slug as property_slug " +
      "from leads l left join properties p on p.id::text=l.property_id::text " +
      "where l.public_tracking_token=$1 limit 1",
    [code],
  );

  const row = rows[0];
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "درخواستی با این کد پیدا نشد." });
  }

  const status = String(row.status || "new") as LeadStatus;
  const visitStatus = String(row.visit_status || "none") as VisitStatus;

  return {
    success: true,
    trackingCode: String(row.public_tracking_token),
    status,
    statusLabel: STATUS_LABEL[status] ?? "در حال پیگیری",
    visitStatus,
    visitStatusLabel: VISIT_LABEL[visitStatus] ?? "بدون درخواست بازدید",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
    consultant: row.consultant ? String(row.consultant) : "",
    deal: row.deal ? String(row.deal) : "",
    propertyType: row.property_type ? String(row.property_type) : "",
    neighborhood: row.neighborhood ? String(row.neighborhood) : "",
    visitPreferredAt: row.visit_preferred_at ? new Date(String(row.visit_preferred_at)).toISOString() : null,
    property: row.property_title
      ? {
          title: String(row.property_title),
          slug: row.property_slug ? String(row.property_slug) : "",
        }
      : null,
  };
});
