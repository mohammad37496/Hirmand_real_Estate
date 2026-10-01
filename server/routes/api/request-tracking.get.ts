import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  new: "درخواست جدید",
  contacted: "تماس گرفته شد",
  follow_up: "در انتظار پیگیری",
  visited: "بازدید انجام شد",
  contract: "قرارداد",
  closed: "بسته‌شده",
  spam: "نامعتبر",
};

const VISIT_STATUS_LABEL: Record<string, string> = {
  none: "بدون بازدید",
  requested: "درخواست بازدید",
  confirmed: "بازدید تأیید شد",
  completed: "بازدید انجام شد",
  cancelled: "بازدید لغو شد",
};

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const query = getQuery(event);
  const token = typeof query.token === "string" ? query.token.trim().slice(0, 120) : "";

  if (!/^[a-f0-9]{32,64}$/i.test(token)) {
    throw createError({ statusCode: 400, statusMessage: "کد پیگیری معتبر نیست." });
  }
  if (dbSource === "unconfigured") {
    return { enabled: false, found: false };
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select
       l.id::text as id,
       l.deal,
       l.property_type,
       l.neighborhood,
       l.status,
       l.visit_status,
       l.visit_preferred_at,
       l.created_at,
       l.tracking_token,
       p.title as property_title,
       p.slug as property_slug
     from leads l
     left join properties p on p.id::text=l.property_id::text
     where l.tracking_token=$1
     limit 1`,
    [token],
  );
  const lead = rows[0];
  if (!lead) return { enabled: true, found: false };

  const activities = await sql.query<Record<string, unknown>>(
    `select activity_type, title, note, created_at
     from lead_activities
     where lead_id=$1
     order by created_at desc
     limit 12`,
    [String(lead.id)],
  );

  return {
    enabled: true,
    found: true,
    request: {
      token: String(lead.tracking_token),
      status: String(lead.status ?? "new"),
      statusLabel: STATUS_LABEL[String(lead.status ?? "new")] ?? "در حال بررسی",
      visitStatus: String(lead.visit_status ?? "none"),
      visitStatusLabel: VISIT_STATUS_LABEL[String(lead.visit_status ?? "none")] ?? String(lead.visit_status ?? "none"),
      deal: String(lead.deal ?? ""),
      propertyType: String(lead.property_type ?? ""),
      neighborhood: String(lead.neighborhood ?? ""),
      propertyTitle: String(lead.property_title ?? ""),
      propertySlug: String(lead.property_slug ?? ""),
      preferredAt: lead.visit_preferred_at ? new Date(String(lead.visit_preferred_at)).toISOString() : null,
      createdAt: new Date(String(lead.created_at)).toISOString(),
    },
    activities: activities.map((row) => ({
      type: String(row.activity_type ?? ""),
      title: String(row.title ?? "به‌روزرسانی"),
      note: String(row.note ?? ""),
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
  };
});
