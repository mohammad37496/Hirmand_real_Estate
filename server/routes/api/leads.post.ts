import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { buildBudgetLeadNote, budgetEquivalent } from "@/lib/budget-lead";

const matchSchema = z.object({
  slug: z.string().trim().min(1).max(220),
  title: z.string().trim().min(1).max(180),
  tier: z.enum(["within", "convertible", "near"]),
  score: z.number().min(0).max(100),
  suggestedDeposit: z.number().min(0).max(999999999999999),
  suggestedRent: z.number().min(0).max(999999999999999),
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^09\d{9}$/),
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
  const sql = await getSql();
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
         set name=$2, deal=$3, property_type=$4, neighborhood=$5, consultant=$6, note=$7,
             source=$8, budget_deposit=$9, budget_rent=$10, budget_rate=$11,
             budget_equivalent=$12, budget_bedrooms=$13, matched_properties=$14::jsonb,
             match_count=$15, updated_at=current_timestamp
         where id=$1`,
        [
          existing[0].id,
          parsed.data.name,
          parsed.data.deal,
          parsed.data.propertyType,
          parsed.data.neighborhood,
          parsed.data.consultant,
          note,
          parsed.data.source,
          budgetDeposit || null,
          budgetRent || null,
          30_000,
          equivalent || null,
          parsed.data.budgetBedrooms ?? null,
          JSON.stringify(matchedProperties),
          matchedProperties.length,
        ],
      );
      return { success: true, duplicate: true, updated: true, id: existing[0].id };
    }
    return { success: true, duplicate: true, id: existing[0].id };
  }

  const rows = await sql.query<{ id: string }>(
    `insert into leads (
      id, name, phone, deal, property_type, neighborhood, consultant, note, source,
      budget_deposit, budget_rent, budget_rate, budget_equivalent, budget_bedrooms,
      matched_properties, match_count
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
    returning id`,
    [
      crypto.randomUUID(),
      parsed.data.name,
      parsed.data.phone,
      parsed.data.deal,
      parsed.data.propertyType,
      parsed.data.neighborhood,
      parsed.data.consultant,
      note,
      parsed.data.source,
      budgetDeposit || null,
      budgetRent || null,
      parsed.data.source === "budget_match" ? DEFAULT_MATCH_RAHN_RATE : null,
      equivalent || null,
      parsed.data.budgetBedrooms ?? null,
      JSON.stringify(matchedProperties),
      matchedProperties.length,
    ],
  );
  return { success: true, id: rows[0]?.id ?? null, duplicate: false };
});