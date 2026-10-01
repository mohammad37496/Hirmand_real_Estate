import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const MAX_FAVORITES = 100;

const bodySchema = z.object({
  action: z.enum(["list", "sync", "toggle", "clear", "update_meta"]),
  slugs: z.array(z.string().trim().min(1).max(220)).max(MAX_FAVORITES).optional().default([]),
  slug: z.string().trim().min(1).max(220).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  privateNote: z.string().trim().max(1000).optional(),
  priority: z.coerce.number().int().min(0).max(3).optional(),
});

function clean(slugs: string[]) {
  return Array.from(new Set(slugs.map((slug) => slug.trim()).filter(Boolean))).slice(0, MAX_FAVORITES);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertSameOrigin(event);
  const parsed = bodySchema.safeParse(await readBody(event).catch(() => ({})));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "درخواست ذخیره‌ها نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, slugs: [] };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const ownerId = userId ?? visitorId;
  const ownerColumn = userId ? "user_id" : "visitor_id";
  const sql = await getSql();

  if (parsed.data.action === "sync") {
    const incoming = clean(parsed.data.slugs);
    if (incoming.length) {
      await sql.query(
        `insert into customer_favorites(visitor_id, user_id, property_slug, created_at, updated_at)
         select $1, $2, item, current_timestamp, current_timestamp
         from unnest($3::text[]) as item
         on conflict(visitor_id, property_slug)
         do update set user_id=coalesce(excluded.user_id, customer_favorites.user_id), updated_at=current_timestamp`,
        [visitorId, userId, incoming],
      );
    }
  }

  if (parsed.data.action === "toggle") {
    if (!parsed.data.slug) throw createError({ statusCode: 400, statusMessage: "فایل مشخص نشده است." });
    const existing = await sql.query<{ property_slug: string }>(
      `select property_slug from customer_favorites where ${ownerColumn}=$1 and property_slug=$2 limit 1`,
      [ownerId, parsed.data.slug],
    );
    if (existing[0]) {
      await sql.query(
        `delete from customer_favorites where ${ownerColumn}=$1 and property_slug=$2`,
        [ownerId, parsed.data.slug],
      );
    } else {
      await sql.query(
        `insert into customer_favorites(visitor_id, user_id, property_slug) values($1,$2,$3)
         on conflict(visitor_id, property_slug)
         do update set user_id=coalesce(excluded.user_id, customer_favorites.user_id), updated_at=current_timestamp`,
        [visitorId, userId, parsed.data.slug],
      );
    }
  }

  if (parsed.data.action === "clear") {
    await sql.query(`delete from customer_favorites where ${ownerColumn}=$1`, [ownerId]);
  }

  if (parsed.data.action === "update_meta") {
    if (!parsed.data.slug) throw createError({ statusCode: 400, statusMessage: "فایل مشخص نشده است." });
    if (parsed.data.category === undefined && parsed.data.privateNote === undefined && parsed.data.priority === undefined) {
      throw createError({ statusCode: 400, statusMessage: "اطلاعاتی برای ویرایش ارسال نشده است." });
    }
    const updated = await sql.query(
      `update customer_favorites
       set category=coalesce($3, category),
           private_note=coalesce($4, private_note),
           priority=coalesce($5, priority),
           updated_at=current_timestamp
       where ${ownerColumn}=$1 and property_slug=$2
       returning property_slug, category, private_note, priority`,
      [ownerId, parsed.data.slug, parsed.data.category ?? null, parsed.data.privateNote ?? null, parsed.data.priority ?? null],
    );
    if (!updated[0]) throw createError({ statusCode: 404, statusMessage: "این فایل در ذخیره‌های شما نیست." });
  }

  const rows = await sql.query<{ property_slug: string; category: string; private_note: string; priority: number }>(
    `select property_slug, category, private_note, priority
     from customer_favorites
     where ${ownerColumn}=$1
     order by updated_at desc
     limit ${MAX_FAVORITES}`,
    [ownerId],
  );

  return {
    enabled: true,
    slugs: rows.map((row) => String(row.property_slug)),
    metadata: rows.map((row) => ({
      slug: String(row.property_slug),
      category: String(row.category || "عمومی"),
      privateNote: String(row.private_note || ""),
      priority: Number(row.priority || 0),
    })),
  };
});
