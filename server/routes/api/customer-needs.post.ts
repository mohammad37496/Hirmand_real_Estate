import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const schema = z.object({
  action: z.enum(["get","save"]).default("get"),
  transactionType: z.enum(["buy","sell","rent","mortgage"]).optional(),
  propertyType: z.enum(["apartment","villa","office","heritage","land","commercial"]).optional(),
  neighborhoods: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  minPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  maxPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  minArea: z.coerce.number().min(0).max(100000).nullable().optional(),
  maxArea: z.coerce.number().min(0).max(100000).nullable().optional(),
  bedrooms: z.coerce.number().int().min(0).max(30).nullable().optional(),
  requestedAmenities: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  mustHaveAmenities: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
}).superRefine((value, ctx) => {
  if (value.minPrice != null && value.maxPrice != null && value.minPrice > value.maxPrice) {
    ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "حداکثر بودجه نمی‌تواند کمتر از حداقل بودجه باشد." });
  }
  if (value.minArea != null && value.maxArea != null && value.minArea > value.maxArea) {
    ctx.addIssue({ code: "custom", path: ["maxArea"], message: "حداکثر متراژ نمی‌تواند کمتر از حداقل متراژ باشد." });
  }
});

function normalizeList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).slice(0, 40);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  assertSameOrigin(event);
  const parsed = schema.safeParse(await readBody(event).catch(() => ({})));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "پروفایل نیاز مشتری نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, profile: null };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();

  if (parsed.data.action === "save") {
    const p = parsed.data;
    await sql.query(
      `insert into customer_need_profiles
       (visitor_id,user_id,transaction_type,property_type,neighborhoods,min_price,max_price,min_area,max_area,bedrooms,requested_amenities,must_have_amenities,updated_at)
       values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,current_timestamp)
       on conflict(visitor_id) do update set
         user_id=excluded.user_id,
         transaction_type=excluded.transaction_type,
         property_type=excluded.property_type,
         neighborhoods=excluded.neighborhoods,
         min_price=excluded.min_price,
         max_price=excluded.max_price,
         min_area=excluded.min_area,
         max_area=excluded.max_area,
         bedrooms=excluded.bedrooms,
         requested_amenities=excluded.requested_amenities,
         must_have_amenities=excluded.must_have_amenities,
         updated_at=current_timestamp`,
      [
        visitorId, userId, p.transactionType ?? "", p.propertyType ?? "",
        JSON.stringify(normalizeList(p.neighborhoods)),
        p.minPrice ?? null, p.maxPrice ?? null, p.minArea ?? null, p.maxArea ?? null,
        p.bedrooms ?? null, JSON.stringify(normalizeList(p.requestedAmenities)),
        JSON.stringify(normalizeList(p.mustHaveAmenities)),
      ],
    );
  }

  const rows = await sql.query<Record<string, unknown>>(
    "select transaction_type, property_type, neighborhoods, min_price, max_price, min_area, max_area, bedrooms, requested_amenities, must_have_amenities, updated_at " +
    "from customer_need_profiles where visitor_id=$1 or ($2 is not null and user_id=$2) order by case when visitor_id=$1 then 0 else 1 end limit 1",
    [visitorId, userId],
  );
  const row = rows[0];
  return {
    enabled: true,
    profile: row ? {
      transactionType: String(row.transaction_type ?? ""),
      propertyType: String(row.property_type ?? ""),
      neighborhoods: Array.isArray(row.neighborhoods) ? row.neighborhoods.filter((x): x is string => typeof x === "string") : [],
      minPrice: row.min_price == null ? null : Number(row.min_price),
      maxPrice: row.max_price == null ? null : Number(row.max_price),
      minArea: row.min_area == null ? null : Number(row.min_area),
      maxArea: row.max_area == null ? null : Number(row.max_area),
      bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
      requestedAmenities: Array.isArray(row.requested_amenities) ? row.requested_amenities.filter((x): x is string => typeof x === "string") : [],
      mustHaveAmenities: Array.isArray(row.must_have_amenities) ? row.must_have_amenities.filter((x): x is string => typeof x === "string") : [],
      updatedAt: row.updated_at == null ? null : new Date(String(row.updated_at)).toISOString(),
    } : null,
  };
});