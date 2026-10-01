import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const schema = z.object({
  action: z.enum(["create","list"]).default("create"),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^09\d{9}$/),
  preferredAt: z.string().trim().max(80).optional(),
  propertyId: z.string().trim().max(120).optional(),
  propertyTitle: z.string().trim().max(180).optional(),
  note: z.string().trim().max(1200).default(""),
});

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "اطلاعات درخواست تماس ناقص یا نامعتبر است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "ثبت درخواست تماس فعلاً فعال نیست." });

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();

  if (parsed.data.action === "list") {
    const column = userId ? "user_id" : "visitor_id";
    const value = userId ?? visitorId;
    const rows = await sql.query<Record<string, unknown>>(
      `select id,name,phone,preferred_at,property_id,property_title,note,status,created_at,updated_at
       from callback_requests where ${column}=$1 order by created_at desc limit 20`,
      [value],
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
        status: String(row.status),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      })),
    };
  }

  if (!parsed.data.name || !parsed.data.phone) throw createError({ statusCode: 400, statusMessage: "نام و شماره موبایل را وارد کنید." });

  let preferredAt: string | null = null;
  if (parsed.data.preferredAt) {
    const date = new Date(parsed.data.preferredAt);
    if (!Number.isFinite(date.getTime())) throw createError({ statusCode: 400, statusMessage: "زمان تماس نامعتبر است." });
    if (date.getTime() < Date.now() + 30 * 60 * 1000) throw createError({ statusCode: 400, statusMessage: "زمان تماس باید حداقل ۳۰ دقیقه از اکنون فاصله داشته باشد." });
    preferredAt = date.toISOString();
  }

  const recent = await sql.query<{ id: string }>(
    "select id from callback_requests where phone=$1 and created_at > current_timestamp - interval '30 minutes' and status not in ('cancelled','completed') limit 1",
    [parsed.data.phone],
  );
  if (recent[0]) return { enabled: true, duplicate: true, id: recent[0].id };

  const rows = await sql.query<{ id: string }>(
    "insert into callback_requests(id,visitor_id,user_id,name,phone,preferred_at,property_id,property_title,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [
      crypto.randomUUID(),
      visitorId,
      userId,
      parsed.data.name,
      parsed.data.phone,
      preferredAt,
      parsed.data.propertyId ?? null,
      parsed.data.propertyTitle ?? "",
      parsed.data.note.trim(),
    ],
  );
  if (!rows[0]) throw createError({ statusCode: 500, statusMessage: "ثبت درخواست تماس انجام نشد." });

  return { enabled: true, duplicate: false, id: rows[0].id };
});
