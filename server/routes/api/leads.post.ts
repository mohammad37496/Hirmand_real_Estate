import { createError, defineEventHandler, getCookie, readBody } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { buildBudgetLeadNote, budgetEquivalent } from "@/lib/budget-lead";
import { DEFAULT_MATCH_RAHN_RATE } from "@/lib/budget-matching";

const VISITOR_COOKIE = "hirmand_visitor_id";

const matchSchema = z.object({
  slug: z.string().trim().min(1).max(220),
  title: z.string().trim().min(1).max(180),
  tier: z.enum(["within", "convertible", "near"]),
  score: z.number().min(0).max(100),
  suggestedDeposit: z.number().min(0).max(999999999999999),
  suggestedRent: z.number().min(0).max(999999999999999),
  gapEquivalent: z.number().min(0).max(999999999999999).optional(),
  reason: z.string().trim().max(500).optional(),
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^09\d{9}$/),
  peopleCount: z.number().int().min(1).max(20).optional(),
  job: z.string().trim().max(100).default(""),
  deal: z.string().trim().min(1).max(40),
  propertyType: z.string().trim().max(80).default(""),
  neighborhood: z.string().trim().max(80).default(""),
  floorPreference: z.string().trim().max(40).default(""),
  requestedBedrooms: z.number().int().min(0).max(20).optional(),
  requestedAmenities: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  consultant: z.string().trim().max(80).default(""),
  note: z.string().trim().max(1500).default(""),
  leaseDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(["website", "budget_match"]).optional().default("website"),
  propertyId: z.string().trim().min(1).max(120).optional(),
  visitPreferredAt: z.string().trim().max(80).optional(),
  budgetDeposit: z.number().int().min(0).max(999999999999999).optional(),
  budgetRent: z.number().int().min(0).max(999999999999999).optional(),
  budgetPurchase: z.number().int().min(0).max(999999999999999).optional(),
  budgetSale: z.number().int().min(0).max(999999999999999).optional(),
  budgetDepositMin: z.number().int().min(0).max(999999999999999).optional(),
  budgetDepositMax: z.number().int().min(0).max(999999999999999).optional(),
  budgetRentMin: z.number().int().min(0).max(999999999999999).optional(),
  budgetRentMax: z.number().int().min(0).max(999999999999999).optional(),
  budgetPurchaseMin: z.number().int().min(0).max(999999999999999).optional(),
  budgetPurchaseMax: z.number().int().min(0).max(999999999999999).optional(),
  budgetSaleMin: z.number().int().min(0).max(999999999999999).optional(),
  budgetSaleMax: z.number().int().min(0).max(999999999999999).optional(),
  budgetBedrooms: z.number().int().min(1).max(30).optional(),
  matches: z.array(matchSchema).max(12).optional().default([]),
}).superRefine((value, ctx) => {
  if (value.source === "budget_match" && (value.budgetDeposit ?? 0) <= 0 && (value.budgetRent ?? 0) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetDeposit"], message: "بودجه نامعتبر است." });
  }

  if (value.visitPreferredAt) {
    const visitDate = new Date(value.visitPreferredAt);
    if (!Number.isFinite(visitDate.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitPreferredAt"], message: "زمان بازدید نامعتبر است." });
    } else if (visitDate.getTime() < Date.now() + 30 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitPreferredAt"], message: "زمان بازدید باید حداقل ۳۰ دقیقه از اکنون فاصله داشته باشد." });
    }
  }
  if (value.visitPreferredAt && !value.propertyId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["propertyId"], message: "برای درخواست بازدید، فایل مشخص نشده است." });
  }
  if (value.propertyId && !value.visitPreferredAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitPreferredAt"], message: "زمان پیشنهادی بازدید مشخص نشده است." });
  }
  if (value.leaseDeadline) {
    const parsedDate = new Date(value.leaseDeadline + "T00:00:00Z");
    const normalized = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
    if (normalized !== value.leaseDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["leaseDeadline"], message: "تاریخ مهلت نامعتبر است." });
    }
    if (value.deal !== "رهن" && value.deal !== "اجاره") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["leaseDeadline"], message: "تاریخ مهلت فقط برای رهن یا اجاره مجاز است." });
    }
  }
  if ((value.budgetDepositMin ?? 0) > (value.budgetDepositMax ?? value.budgetDepositMin ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetDepositMin"], message: "حداقل رهن نمی‌تواند بیشتر از حداکثر رهن باشد." });
  }
  if ((value.budgetRentMin ?? 0) > (value.budgetRentMax ?? value.budgetRentMin ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetRentMin"], message: "حداقل اجاره نمی‌تواند بیشتر از حداکثر اجاره باشد." });
  }
  if ((value.budgetPurchaseMin ?? 0) > (value.budgetPurchaseMax ?? value.budgetPurchaseMin ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetPurchaseMin"], message: "حداقل خرید نمی‌تواند بیشتر از حداکثر خرید باشد." });
  }
  if ((value.budgetSaleMin ?? 0) > (value.budgetSaleMax ?? value.budgetSaleMin ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetSaleMin"], message: "حداقل فروش نمی‌تواند بیشتر از حداکثر فروش باشد." });
  }
});

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "اطلاعات درخواست ناقص یا نامعتبر است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "ثبت آنلاین درخواست در حال حاضر فعال نیست." });
  const sql = await getSql();
  const visitorId = getCookie(event, VISITOR_COOKIE);
  let acquisition: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    referrer: string | null;
    landingPath: string | null;
  } = {
    source: null,
    medium: null,
    campaign: null,
    referrer: null,
    landingPath: null,
  };

  if (visitorId && /^[a-f0-9-]{20,80}$/i.test(visitorId)) {
    try {
      const acquisitionRows = await sql.query<Record<string, unknown>>(
        `select
           utm_source,
           utm_medium,
           utm_campaign,
           referrer_host,
           landing_path
         from site_visitor_days
         where visitor_id = $1
         order by day desc, last_seen_at desc
         limit 1`,
        [visitorId],
      );
      const row = acquisitionRows[0];
      if (row) {
        acquisition = {
          source: row.utm_source ? String(row.utm_source) : row.referrer_host ? String(row.referrer_host) : null,
          medium: row.utm_medium ? String(row.utm_medium) : null,
          campaign: row.utm_campaign ? String(row.utm_campaign) : null,
          referrer: row.referrer_host ? String(row.referrer_host) : null,
          landingPath: row.landing_path ? String(row.landing_path) : null,
        };
      }
    } catch (error) {
      console.error("[leads] acquisition lookup unavailable", error);
    }
  }
  const existing = await sql.query<{ id: string }>(
    `select id from leads where phone = $1 and created_at > current_timestamp - interval '10 minutes' limit 1`,
    [parsed.data.phone],
  );

  const budgetDepositMin = parsed.data.budgetDepositMin ?? parsed.data.budgetDeposit ?? 0;
  const budgetDeposit = parsed.data.budgetDepositMax ?? parsed.data.budgetDeposit ?? budgetDepositMin;
  const budgetRentMin = parsed.data.budgetRentMin ?? parsed.data.budgetRent ?? 0;
  const budgetRent = parsed.data.budgetRentMax ?? parsed.data.budgetRent ?? budgetRentMin;
  const budgetPurchaseMin = parsed.data.budgetPurchaseMin ?? parsed.data.budgetPurchase ?? 0;
  const budgetPurchase = parsed.data.budgetPurchaseMax ?? parsed.data.budgetPurchase ?? budgetPurchaseMin;
  const budgetSaleMin = parsed.data.budgetSaleMin ?? parsed.data.budgetSale ?? 0;
  const budgetSale = parsed.data.budgetSaleMax ?? parsed.data.budgetSale ?? budgetSaleMin;
  const leaseDeadline = parsed.data.deal === "رهن" || parsed.data.deal === "اجاره"
    ? parsed.data.leaseDeadline ?? null
    : null;
  const matchedProperties = parsed.data.matches.slice(0, 12);
  const budgetPayload = {
    name: parsed.data.name,
    phone: parsed.data.phone,
    depositBudget: budgetDeposit,
    rentBudget: budgetRent,
    propertyType: parsed.data.propertyType,
    neighborhood: parsed.data.neighborhood,
    bedrooms: parsed.data.budgetBedrooms,
    matches: matchedProperties,
    note: parsed.data.note,
  };
  const equivalent = parsed.data.source === "budget_match" ? budgetEquivalent(budgetPayload) : 0;
  const note = parsed.data.source === "budget_match"
    ? buildBudgetLeadNote(budgetPayload)
    : parsed.data.note;

  if (existing[0]) {
    if (parsed.data.propertyId && parsed.data.visitPreferredAt) {
      const visitDate = new Date(parsed.data.visitPreferredAt);
      const propertyRows = await sql.query<{ id: string; property_type: string; neighborhood: string; contact_name: string }>(
        "select id, property_type, neighborhood, contact_name from properties where id::text = $1 and status = 'published' and availability_status not in ('sold','rented','unavailable') limit 1",
        [parsed.data.propertyId],
      );
      if (!propertyRows[0]) throw createError({ statusCode: 404, statusMessage: "فایل موردنظر برای بازدید در دسترس نیست." });
      const rows = await sql.query<{ id: string }>(
        "update leads set name=$2, deal=$3, property_type=$4, neighborhood=$5, consultant=$6, note=$7, property_id=$8, visit_preferred_at=$9, visit_requested_at=current_timestamp, visit_status='requested', follow_up_at=current_timestamp + interval '4 hours', updated_at=current_timestamp where id=$1 returning id",
        [
          existing[0].id,
          parsed.data.name,
          parsed.data.deal || "بازدید",
          propertyRows[0].property_type,
          propertyRows[0].neighborhood,
          propertyRows[0].contact_name || parsed.data.consultant,
          parsed.data.note,
          parsed.data.propertyId,
          visitDate.toISOString(),
        ],
      );
      await sql.query(
        "insert into lead_activities (lead_id, activity_type, title, note, metadata) values ($1,'visit',$2,$3,$4::jsonb)",
        [
          existing[0].id,
          "درخواست بازدید ثبت شد",
          parsed.data.note || "درخواست جدید برای بازدید فایل",
          JSON.stringify({ propertyId: parsed.data.propertyId, visitPreferredAt: visitDate.toISOString() }),
        ],
      ).catch(() => {});
      return { success: true, duplicate: true, updated: Boolean(rows[0]), id: existing[0].id, visitRequested: true };
    }
    if (parsed.data.source === "budget_match") {
      await sql.query(
        `update leads
         set name=$2, people_count=$3, job=$4, deal=$5, property_type=$6, neighborhood=$7, consultant=$8, note=$9,
             source=$10, follow_up_at=current_timestamp + interval '24 hours', lease_deadline=null, acquisition_source=$20, acquisition_medium=$21, acquisition_campaign=$22, acquisition_referrer=$23, acquisition_landing_path=$24, budget_deposit=$11, budget_rent=$12, budget_purchase=$13, budget_sale=$14, budget_rate=$15,
             budget_equivalent=$16, budget_bedrooms=$17, matched_properties=$18::jsonb,
             match_count=$19, floor_preference=$25, budget_deposit_min=$26, budget_deposit_max=$27,
             budget_rent_min=$28, budget_rent_max=$29, budget_purchase_min=$30, budget_purchase_max=$31,
             budget_sale_min=$32, budget_sale_max=$33, requested_amenities=$34::jsonb, requested_bedrooms=$35, updated_at=current_timestamp
         where id=$1`,
        [
          existing[0].id,
          parsed.data.name,
          parsed.data.peopleCount ?? null,
          parsed.data.job,
          parsed.data.deal,
          parsed.data.propertyType,
          parsed.data.neighborhood,
          parsed.data.consultant,
          note,
          parsed.data.source,
          budgetDeposit || null,
          budgetRent || null,
          budgetPurchase || null,
          budgetSale || null,
          DEFAULT_MATCH_RAHN_RATE,
          equivalent || null,
          parsed.data.budgetBedrooms ?? null,
          JSON.stringify(matchedProperties),
          matchedProperties.length,
          acquisition.source,
          acquisition.medium,
          acquisition.campaign,
          acquisition.referrer,
          acquisition.landingPath,
          parsed.data.floorPreference,
          budgetDepositMin || null,
          budgetDeposit || null,
          budgetRentMin || null,
          budgetRent || null,
          budgetPurchaseMin || null,
          budgetPurchase || null,
          budgetSaleMin || null,
          budgetSale || null,
          JSON.stringify(parsed.data.requestedAmenities),
          parsed.data.requestedBedrooms ?? null,
        ],
      );
      return { success: true, duplicate: true, updated: true, id: existing[0].id };
    }
    return { success: true, duplicate: true, id: existing[0].id };
  }

  if (parsed.data.propertyId && parsed.data.visitPreferredAt) {
    const visitDate = new Date(parsed.data.visitPreferredAt);
    const propertyRows = await sql.query<{ id: string; title: string; property_type: string; neighborhood: string; contact_name: string }>(
      "select id, title, property_type, neighborhood, contact_name, availability_status from properties where id::text = $1 and status = 'published' and availability_status not in ('sold','rented','unavailable') limit 1",
      [parsed.data.propertyId],
    );
    const property = propertyRows[0];
    if (!property) throw createError({ statusCode: 404, statusMessage: "فایل موردنظر برای بازدید در دسترس نیست." });
    const rows = await sql.query<{ id: string }>(
      "insert into leads (id, name, phone, people_count, job, deal, property_type, neighborhood, consultant, note, source, follow_up_at, floor_preference, property_id, visit_preferred_at, visit_requested_at, visit_status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'website',current_timestamp + interval '4 hours',$11,$12,$13,current_timestamp,'requested') returning id",
      [
        crypto.randomUUID(),
        parsed.data.name,
        parsed.data.phone,
        parsed.data.peopleCount ?? null,
        parsed.data.job,
        "بازدید",
        property.property_type,
        property.neighborhood,
        property.contact_name || parsed.data.consultant,
        parsed.data.note.trim() || "درخواست بازدید فایل",
        parsed.data.floorPreference,
        property.id,
        visitDate.toISOString(),
      ],
    );
    if (!rows[0]) throw createError({ statusCode: 500, statusMessage: "ثبت درخواست بازدید انجام نشد." });
    await sql.query(
      "insert into lead_activities (lead_id, activity_type, title, note, metadata) values ($1,'visit',$2,$3,$4::jsonb)",
      [
        rows[0].id,
        "درخواست بازدید ثبت شد",
        "فایل: " + property.title,
        parsed.data.note.trim() || "درخواست بازدید از فایل",
        JSON.stringify({ propertyId: property.id, visitPreferredAt: visitDate.toISOString() }),
      ],
    ).catch(() => {});
    return { success: true, duplicate: false, id: rows[0].id, visitRequested: true };
  }
  const rows = await sql.query<{ id: string }>(
    `insert into leads (
      id, name, phone, people_count, job, deal, property_type, neighborhood, consultant, note, source,
      acquisition_source, acquisition_medium, acquisition_campaign, acquisition_referrer, acquisition_landing_path,
      follow_up_at, lease_deadline, budget_deposit, budget_rent, budget_purchase, budget_sale, budget_rate, budget_equivalent, budget_bedrooms,
      floor_preference, matched_properties, match_count,
      budget_deposit_min, budget_deposit_max, budget_rent_min, budget_rent_max,
      budget_purchase_min, budget_purchase_max, budget_sale_min, budget_sale_max,
      requested_amenities, requested_bedrooms
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,current_timestamp + interval '24 hours',$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36::jsonb,$37)
    returning id`,
    [
      crypto.randomUUID(),
      parsed.data.name,
      parsed.data.phone,
      parsed.data.peopleCount ?? null,
      parsed.data.job,
      parsed.data.deal,
      parsed.data.propertyType,
      parsed.data.neighborhood,
      parsed.data.consultant,
      note,
      parsed.data.source,
      acquisition.source,
      acquisition.medium,
      acquisition.campaign,
      acquisition.referrer,
      acquisition.landingPath,
      leaseDeadline,
      budgetDeposit || null,
      budgetRent || null,
      budgetPurchase || null,
      budgetSale || null,
      parsed.data.source === "budget_match" ? DEFAULT_MATCH_RAHN_RATE : null,
      equivalent || null,
      parsed.data.budgetBedrooms ?? null,
      parsed.data.floorPreference,
      JSON.stringify(matchedProperties),
      matchedProperties.length,
      budgetDepositMin || null,
      budgetDeposit || null,
      budgetRentMin || null,
      budgetRent || null,
      budgetPurchaseMin || null,
      budgetPurchase || null,
      budgetSaleMin || null,
      budgetSale || null,
      JSON.stringify(parsed.data.requestedAmenities),
      parsed.data.requestedBedrooms ?? null,
    ],
  );
  return { success: true, id: rows[0]?.id ?? null, duplicate: false };
});