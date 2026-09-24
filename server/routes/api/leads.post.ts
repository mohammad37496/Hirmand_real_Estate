import { createError, defineEventHandler, getCookie, readBody } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { buildBudgetLeadNote, budgetEquivalent } from "@/lib/budget-lead";
import { DEFAULT_MATCH_RAHN_RATE } from "@/lib/budget-matching";
import { enforceRateLimit } from "@/lib/rate-limit.server";

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
  consultant: z.string().trim().max(80).default(""),
  note: z.string().trim().max(1500).default(""),
  source: z.enum(["website", "budget_match"]).optional().default("website"),
  budgetDeposit: z.number().int().min(0).max(999999999999999).optional(),
  budgetRent: z.number().int().min(0).max(999999999999999).optional(),
  budgetBedrooms: z.number().int().min(1).max(30).optional(),
  matches: z.array(matchSchema).max(12).optional().default([]),
}).superRefine((value, ctx) => {
  if (value.source === "budget_match" && (value.budgetDeposit ?? 0) <= 0 && (value.budgetRent ?? 0) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetDeposit"], message: "بودجه نامعتبر است." });
  }
});

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "اطلاعات درخواست ناقص یا نامعتبر است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "ثبت آنلاین درخواست در حال حاضر فعال نیست." });
  if (!(await enforceRateLimit(event, { scope: "lead-create", limit: 8, windowSeconds: 600 }))) {
    throw createError({
      statusCode: 429,
      statusMessage: "تعداد درخواست‌ها در این بازه زیاد است. چند دقیقه بعد دوباره تلاش کنید.",
    });
  }
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
  const requestToken = crypto.randomUUID();
  const guardRows = await sql.query<{ acquired: boolean }>(
    `insert into lead_dedupe_guard (phone, request_token, last_submitted_at)
     values ($1, $2, current_timestamp)
     on conflict (phone) do update set
       request_token = case
         when lead_dedupe_guard.last_submitted_at <= current_timestamp - interval '10 minutes'
         then excluded.request_token
         else lead_dedupe_guard.request_token
       end,
       last_submitted_at = case
         when lead_dedupe_guard.last_submitted_at <= current_timestamp - interval '10 minutes'
         then excluded.last_submitted_at
         else lead_dedupe_guard.last_submitted_at
       end
     returning request_token = $2 as acquired`,
    [parsed.data.phone, requestToken],
  );
  if (!guardRows[0]?.acquired) {
    const duplicateRows = await sql.query<{ id: string }>(
      `select id from leads
       where phone = $1
         and created_at > current_timestamp - interval '10 minutes'
       order by created_at desc
       limit 1`,
      [parsed.data.phone],
    );
    return {
      success: true,
      duplicate: true,
      id: duplicateRows[0]?.id ?? null,
    };
  }

  const existing = await sql.query<{ id: string }>(
    `select id from leads where phone = $1 and created_at > current_timestamp - interval '10 minutes' limit 1`,
    [parsed.data.phone],
  );

  const budgetDeposit = parsed.data.budgetDeposit ?? 0;
  const budgetRent = parsed.data.budgetRent ?? 0;
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
    if (parsed.data.source === "budget_match") {
      await sql.query(
        `update leads
         set name=$2, people_count=$3, job=$4, deal=$5, property_type=$6, neighborhood=$7, consultant=$8, note=$9,
             source=$10, follow_up_at=current_timestamp + interval '24 hours', acquisition_source=$18, acquisition_medium=$19, acquisition_campaign=$20, acquisition_referrer=$21, acquisition_landing_path=$22, budget_deposit=$11, budget_rent=$12, budget_rate=$13,
             budget_equivalent=$14, budget_bedrooms=$15, matched_properties=$16::jsonb,
             match_count=$17, updated_at=current_timestamp
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
        ],
      );
      return { success: true, duplicate: true, updated: true, id: existing[0].id };
    }
    return { success: true, duplicate: true, id: existing[0].id };
  }

  let rows: { id: string }[] = [];
  try {
    rows = await sql.query<{ id: string }>(
    `insert into leads (
      id, name, phone, people_count, job, deal, property_type, neighborhood, consultant, note, source,
      acquisition_source, acquisition_medium, acquisition_campaign, acquisition_referrer, acquisition_landing_path,
      follow_up_at, budget_deposit, budget_rent, budget_rate, budget_equivalent, budget_bedrooms,
      matched_properties, match_count
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,current_timestamp + interval '24 hours',$17,$18,$19,$20,$21,$22::jsonb,$23)
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
      budgetDeposit || null,
      budgetRent || null,
      parsed.data.source === "budget_match" ? DEFAULT_MATCH_RAHN_RATE : null,
      equivalent || null,
      parsed.data.budgetBedrooms ?? null,
      JSON.stringify(matchedProperties),
      matchedProperties.length,
    ],
    );
  } catch (error) {
    await sql.query(
      `delete from lead_dedupe_guard
       where phone = $1 and request_token = $2`,
      [parsed.data.phone, requestToken],
    ).catch(() => undefined);
    throw error;
  }

  return { success: true, id: rows[0]?.id ?? null, duplicate: false };
});