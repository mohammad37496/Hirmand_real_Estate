import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^09\d{9}$/),
  deal: z.string().trim().min(1).max(40),
  propertyType: z.string().trim().max(80).default("") ,
  neighborhood: z.string().trim().max(80).default("") ,
  consultant: z.string().trim().max(80).default("") ,
  note: z.string().trim().max(1500).default(""),
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
  if (existing[0]) return { success: true, duplicate: true };
  const rows = await sql.query<{ id: string }>(
    `insert into leads (id, name, phone, deal, property_type, neighborhood, consultant, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [crypto.randomUUID(), parsed.data.name, parsed.data.phone, parsed.data.deal, parsed.data.propertyType, parsed.data.neighborhood, parsed.data.consultant, parsed.data.note],
  );
  return { success: true, id: rows[0]?.id ?? null, duplicate: false };
});