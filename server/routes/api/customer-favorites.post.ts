import { createError, defineEventHandler, getCookie, readBody, setCookie, setResponseHeader, type H3Event } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const COOKIE_NAME = "hirmand_visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_FAVORITES = 100;

const bodySchema = z.object({
  action: z.enum(["list", "sync", "toggle", "clear"]),
  slugs: z.array(z.string().trim().min(1).max(220)).max(MAX_FAVORITES).optional().default([]),
  slug: z.string().trim().min(1).max(220).optional(),
});

function validVisitorId(value: string | undefined) {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}

async function ensureVisitor(event: H3Event): Promise<string> {
  const existing = getCookie(event, COOKIE_NAME);
  if (validVisitorId(existing)) return existing;
  const visitorId = crypto.randomUUID();
  setCookie(event, COOKIE_NAME, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return visitorId;
}

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
  const sql = await getSql();

  if (parsed.data.action === "sync") {
    const incoming = clean(parsed.data.slugs);
    if (incoming.length) {
      await sql.query(
        `insert into customer_favorites(visitor_id, property_slug, created_at, updated_at)
         select $1, item, current_timestamp, current_timestamp
         from unnest($2::text[]) as item
         on conflict(visitor_id, property_slug)
         do update set updated_at=current_timestamp`,
        [visitorId, incoming],
      );
    }
  }

  if (parsed.data.action === "toggle") {
    if (!parsed.data.slug) throw createError({ statusCode: 400, statusMessage: "فایل مشخص نشده است." });
    const existing = await sql.query<{ property_slug: string }>(
      "select property_slug from customer_favorites where ${userId ? "user_id=$1" : "visitor_id=$1"} and property_slug=$2 limit 1",
      [visitorId, userId, parsed.data.slug],
    );
    if (existing[0]) {
      await sql.query(`delete from customer_favorites where ${userId ? "user_id=$1" : "visitor_id=$1"} and property_slug=$2`, [userId ?? visitorId, parsed.data.slug]);
    } else {
      await sql.query(
        "insert into customer_favorites(visitor_id, user_id, property_slug) values($1,$2,$3) on conflict(visitor_id, property_slug) do update set user_id=coalesce(excluded.user_id, customer_favorites.user_id), updated_at=current_timestamp",
        [visitorId, parsed.data.slug],
      );
    }
  }

  if (parsed.data.action === "clear") {
    await sql.query("delete from customer_favorites where visitor_id=$1", [visitorId]);
  }

  const rows = await sql.query<{ property_slug: string }>(
    `select property_slug
     from customer_favorites
     where visitor_id=$1
     order by updated_at desc
     limit 100`,
    [visitorId],
  );

  return { enabled: true, slugs: rows.map((row) => String(row.property_slug)) };
});
