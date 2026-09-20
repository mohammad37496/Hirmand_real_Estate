import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

type Status = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return /[",]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function csvDate(value: unknown) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(String(value)));
  } catch {
    return String(value ?? "");
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = (await readBody(event)) as {
    action?: "list" | "status" | "delete" | "export";
    id?: string;
    status?: Status;
    query?: string;
  };

  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({
      statusCode: 401,
      statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید.",
    });
  }

  if (dbSource === "unconfigured") return { leads: [] };
  const sql = await getSql();

  if (body.action === "export") {
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 80) : "";
    const status = body.status;

    if (status && !["new", "contacted", "follow_up", "visited", "contract", "closed", "spam"].includes(status)) {
      throw createError({ statusCode: 400, statusMessage: "فیلتر وضعیت نامعتبر است." });
    }

    const params: string[] = [];
    const conditions = ["true"];
    if (status) {
      params.push(status);
      conditions.push("status = $1");
    }
    if (query) {
      params.push("%" + query + "%");
      const index = params.length;
      conditions.push(
        "(" +
          ["name", "phone", "deal", "property_type", "neighborhood", "consultant", "note"]
            .map((column) => column + " ilike $" + index)
            .join(" or ") +
          ")",
      );
    }

    const rows = await sql.query<Record<string, unknown>>(
      "select name, phone, deal, property_type, neighborhood, consultant, status, note, source, " +
        "acquisition_source, acquisition_medium, acquisition_campaign, acquisition_referrer, follow_up_at, last_contacted_at, " +
        "budget_deposit, budget_rent, budget_equivalent, budget_bedrooms, match_count, created_at " +
        "from leads where " + conditions.join(" and ") +
        " order by created_at desc limit 50000",
      params,
    );

    const labels: Record<Status, string> = {
      new: "جدید",
      contacted: "تماس گرفته شد",
      follow_up: "پیگیری",
      visited: "بازدید",
      contract: "قرارداد",
      closed: "ناموفق / بسته‌شده",
      spam: "اسپم",
    };
    const header = ["نام", "تلفن", "معامله", "نوع ملک", "محله", "مشاور", "وضعیت", "منبع جذب", "رهن بودجه", "اجاره بودجه", "معادل رهنی", "خواب", "تعداد فایل پیشنهادی", "توضیحات", "تاریخ"];
    const lines = [
      header.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.name,
          row.phone,
          row.deal,
          row.property_type,
          row.neighborhood,
          row.consultant,
          labels[String(row.status) as Status] ?? row.status,
          row.acquisition_source ?? row.source,
          row.budget_deposit,
          row.budget_rent,
          row.budget_equivalent,
          row.budget_bedrooms,
          row.match_count,
          row.note,
          csvDate(row.created_at),
        ].map(csvCell).join(","),
      ),
    ];

    setResponseHeader(event, "content-type", "text/csv; charset=utf-8");
    setResponseHeader(event, "content-disposition", 'attachment; filename="hirmand-leads.csv"');
    setResponseHeader(event, "cache-control", "no-store");
    return "\uFEFF" + lines.join("\n");
  }

  if ((body.action ?? "list") === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      "select id,name,phone,deal,property_type,neighborhood,consultant,note,status,source, " +
        "acquisition_source,acquisition_medium,acquisition_campaign,acquisition_referrer,follow_up_at,last_contacted_at, " +
        "budget_deposit,budget_rent,budget_equivalent,budget_bedrooms,budget_rate,matched_properties,match_count,created_at " +
        "from leads order by created_at desc limit 300",
    );
    return {
      leads: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        phone: String(row.phone),
        deal: String(row.deal),
        propertyType: String(row.property_type ?? ""),
        neighborhood: String(row.neighborhood ?? ""),
        consultant: String(row.consultant ?? ""),
        note: String(row.note ?? ""),
        status: String(row.status) as Status,
        source: String(row.source ?? "website"),
        acquisitionSource: row.acquisition_source == null ? null : String(row.acquisition_source),
        acquisitionMedium: row.acquisition_medium == null ? null : String(row.acquisition_medium),
        acquisitionCampaign: row.acquisition_campaign == null ? null : String(row.acquisition_campaign),
        acquisitionReferrer: row.acquisition_referrer == null ? null : String(row.acquisition_referrer),
        followUpAt: row.follow_up_at == null ? null : new Date(String(row.follow_up_at)).toISOString(),
        lastContactedAt: row.last_contacted_at == null ? null : new Date(String(row.last_contacted_at)).toISOString(),
        budgetDeposit: row.budget_deposit == null ? null : Number(row.budget_deposit),
        budgetRent: row.budget_rent == null ? null : Number(row.budget_rent),
        budgetEquivalent: row.budget_equivalent == null ? null : Number(row.budget_equivalent),
        budgetBedrooms: row.budget_bedrooms == null ? null : Number(row.budget_bedrooms),
        budgetRate: row.budget_rate == null ? null : Number(row.budget_rate),
        matchCount: Number(row.match_count) || 0,
        matchedProperties: Array.isArray(row.matched_properties) ? row.matched_properties : [],
        createdAt: new Date(String(row.created_at)).toISOString(),
      })),
    };
  }

  if (!body.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "شناسه درخواست مشخص نیست.",
    });
  }

  if (body.action === "status") {
    if (!body.status) {
      throw createError({
        statusCode: 400,
        statusMessage: "وضعیت مشخص نیست.",
      });
    }
    await sql.query(
      "update leads set status=$2, follow_up_at=$3, last_contacted_at=case when $2='contacted' then current_timestamp else last_contacted_at end, updated_at=current_timestamp where id=$1",
      [
        body.id,
        body.status,
        ["new", "contacted", "follow_up", "visited"].includes(body.status) ? new Date(Date.now() + (body.status === "new" ? 24 : body.status === "visited" ? 72 : 48) * 60 * 60 * 1000).toISOString() : null,
      ],
    );
    return { success: true };
  }

  if (body.action === "delete") {
    await sql.query("delete from leads where id=$1", [body.id]);
    return { success: true };
  }

  throw createError({
    statusCode: 400,
    statusMessage: "عملیات نامعتبر است.",
  });
});
