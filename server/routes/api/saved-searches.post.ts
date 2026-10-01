import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const COOKIE_NAME = "hirmand_visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_SEARCHES = 10;
const MAX_ALERTS = 30;

type SearchItem = {
  clientId: string;
  name: string;
  params: string;
};

const itemSchema = z.object({
  clientId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  params: z.string().trim().min(1).max(5000),
});

const bodySchema = z.object({
  action: z.enum(["list", "save", "delete", "sync", "seen"]),
  item: itemSchema.optional(),
  items: z.array(itemSchema).max(10).optional().default([]),
  clientId: z.string().trim().min(1).max(120).optional(),
  alertIds: z.array(z.coerce.number().int().positive()).max(100).optional().default([]),
});

function validVisitorId(value: string | undefined) {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const number = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

const PRICE_EXPR =
  "case when p.transaction_type = 'rent' then coalesce(p.rent, p.deposit) " +
  "when p.transaction_type = 'mortgage' then p.deposit else p.price end";

function addParam(values: unknown[], value: unknown, cast: string) {
  values.push(value);
  return "$" + values.length + "::" + cast;
}

function buildFilterSql(searchParams: URLSearchParams, values: unknown[]) {
  const where: string[] = ["p.status = 'published'"];

  const tx = searchParams.get("transaction");
  if (tx === "buy" || tx === "sell" || tx === "rent" || tx === "mortgage") {
    where.push("p.transaction_type = " + addParam(values, tx, "text"));
  }

  const type = searchParams.get("type");
  if (type && ["apartment", "villa", "office", "heritage", "land", "commercial"].includes(type)) {
    where.push("p.property_type = " + addParam(values, type, "text"));
  }

  const neighborhood = searchParams.get("neighborhood")?.trim();
  if (neighborhood) {
    const placeholder = addParam(values, neighborhood, "text");
    where.push(neighborhood.length >= 2 && !neighborhood.includes("%")
      ? "p.neighborhood = " + placeholder
      : "p.neighborhood ilike '%' || " + placeholder + " || '%'");
  }

  const q = searchParams.get("q")?.trim();
  if (q) {
    const placeholder = addParam(values, q, "text");
    where.push("(p.title ilike '%' || " + placeholder + " || '%' or p.neighborhood ilike '%' || " + placeholder + " || '%' or p.address ilike '%' || " + placeholder + " || '%')");
  }

  const numericFilters: Array<[string, string, string]> = [
    ["minArea", "p.area_m2 >= ", "integer"],
    ["maxArea", "p.area_m2 <= ", "integer"],
    ["minPrice", PRICE_EXPR + " >= ", "numeric"],
    ["maxPrice", PRICE_EXPR + " <= ", "numeric"],
    ["bedrooms", "p.bedrooms >= ", "integer"],
    ["bathrooms", "p.bathrooms >= ", "integer"],
    ["minFloor", "p.floor >= ", "integer"],
    ["maxFloor", "p.floor <= ", "integer"],
    ["minFloors", "p.total_floors >= ", "integer"],
    ["maxFloors", "p.total_floors <= ", "integer"],
    ["minYear", "p.built_year >= ", "integer"],
    ["maxYear", "p.built_year <= ", "integer"],
  ];
  for (const [key, sql, cast] of numericFilters) {
    const value = parseNumber(searchParams.get(key));
    if (value != null) where.push(sql + addParam(values, value, cast));
  }

  if (searchParams.get("parking") === "1") where.push("p.parking = true");
  if (searchParams.get("elevator") === "1") where.push("p.elevator = true");
  if (searchParams.get("storage") === "1") where.push("p.storage = true");
  if (searchParams.get("featured") === "1") where.push("(p.featured = true and (p.featured_until is null or p.featured_until >= current_timestamp))");
  if (searchParams.get("images") === "1") where.push("jsonb_typeof(coalesce(p.images, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p.images, '[]'::jsonb)) > 0");
  if (searchParams.get("location") === "1") where.push("(p.latitude is not null and p.longitude is not null)");
  if (searchParams.get("convertible") === "1") where.push("p.convertible = true");
  if (searchParams.get("floorType") === "suite") where.push("p.floor_label = 'suite'");

  const orientation = searchParams.get("orientation");
  const allowedOrientations = ["north","south","east","west","northeast","northwest","southeast","southwest","two_fronts","three_fronts","four_fronts","other"];
  if (orientation && allowedOrientations.includes(orientation)) {
    where.push("p.orientation = " + addParam(values, orientation, "text"));
  }

  const featureSearch = searchParams.get("features")?.trim();
  if (featureSearch) {
    where.push("exists (select 1 from jsonb_array_elements_text(coalesce(p.features, '[]'::jsonb)) as feature(value) where feature.value ilike '%' || " + addParam(values, featureSearch, "text") + " || '%')");
  }

  const specs = (searchParams.get("specs") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 120);
  if (specs.length) {
    where.push(
      "exists (select 1 from unnest(" + addParam(values, specs, "text[]") + ") as selected(value) where " +
      "(selected.value like 'cabinet:%' and p.cabinet_type = substring(selected.value from 9)) or " +
      "(selected.value like 'flooring:%' and p.flooring_type = substring(selected.value from 10)) or " +
      "(selected.value like 'cooling:%' and p.cooling_system = substring(selected.value from 9)) or " +
      "(selected.value like 'heating:%' and p.heating_system = substring(selected.value from 9)) or " +
      "(selected.value like 'closet:%' and p.wall_closet_type = substring(selected.value from 8)) or " +
      "coalesce(p.other_amenities, '[]'::jsonb) ? selected.value)");
  }

  return where;
}

async function persistItem(sql: Awaited<ReturnType<typeof getSql>>, visitorId: string, userId: string | null, item: SearchItem) {
  await sql.query(
    `insert into customer_saved_searches (id, visitor_id, user_id, client_id, name, params, enabled, last_checked_at, updated_at)
     values (gen_random_uuid(), $1, $2, $3, $4, true, current_timestamp, current_timestamp)
     on conflict (visitor_id, client_id)
     do update set
       name=excluded.name,
       params=excluded.params,
       enabled=true,
       last_checked_at=current_timestamp,
       updated_at=current_timestamp`,
    [visitorId, userId, item.clientId, item.name, item.params],
  );
}

async function collectAlerts(sql: Awaited<ReturnType<typeof getSql>>, ownerId: string, ownerColumn: "user_id" | "visitor_id", userId: string | null, visitorId: string) {
  const searches = await sql.query<{
    id: string;
    client_id: string;
    name: string;
    params: string;
    last_checked_at: string | Date;
  }>(
    `select id::text, client_id, name, params, last_checked_at
     from customer_saved_searches
     where ${ownerColumn}=$1 and enabled=true
     order by updated_at desc
     limit 10`,
    [ownerId],
  );

  for (const search of searches) {
    const values: unknown[] = [];
    const filterSql = buildFilterSql(new URLSearchParams(search.params), values);
    const lastChecked = addParam(values, search.last_checked_at, "timestamptz");
    const lastCheckedMs = new Date(String(search.last_checked_at)).getTime();

    const rows = await sql.query<Record<string, unknown>>(
      `select p.id::text as id, p.slug, p.title, p.published_at, p.price_drop_percent, p.price_changed_at
       from properties p
       where ${filterSql.join(" and ")}
         and (
           p.published_at > ${lastChecked}
           or (p.price_changed_at > ${lastChecked} and coalesce(p.price_drop_percent, 0) > 0)
         )
       order by greatest(
         coalesce(extract(epoch from p.published_at), 0),
         coalesce(extract(epoch from p.price_changed_at), 0)
       ) desc
       limit 20`,
      values,
    );

    for (const row of rows) {
      const publishedAt = row.published_at ? new Date(String(row.published_at)) : null;
      const priceChangedAt = row.price_changed_at ? new Date(String(row.price_changed_at)) : null;
      const isNew = Boolean(publishedAt && publishedAt.getTime() > lastCheckedMs);
      const isDrop = Boolean(priceChangedAt && Number(row.price_drop_percent) > 0 && priceChangedAt.getTime() > lastCheckedMs);
      if (!isNew && !isDrop) continue;

      const alertType = isDrop && !isNew ? "price_drop" : "new_match";
      const stamp = alertType === "new_match" ? publishedAt?.getTime() : priceChangedAt?.getTime();
      const eventKey = alertType + ":" + String(row.id) + ":" + String(stamp ?? "");
      const title = String(row.title ?? "فایل ملکی");
      const message = alertType === "price_drop"
        ? title + " · کاهش " + Number(row.price_drop_percent).toLocaleString("fa-IR") + "٪ در قیمت ثبت‌شده"
        : "فایل جدید مطابق جست‌وجوی «" + search.name + "»: " + title;

      await sql.query(
        `insert into customer_saved_search_alerts
          (saved_search_id, visitor_id, user_id, property_id, property_slug, alert_type, event_key, title, message)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (event_key) do nothing`,
        [search.id, visitorId, userId, String(row.id), String(row.slug), alertType, eventKey, title, message],
      );
    }

    await sql.query(
      "update customer_saved_searches set last_checked_at=current_timestamp where id=$1 and ${ownerColumn}=$2",
      [search.id, visitorId],
    );
  }

  await sql.query(
    "delete from customer_saved_search_alerts where ${ownerColumn}=$1 and created_at < current_timestamp - interval '120 days'",
    [ownerId],
  );
}

async function listData(sql: Awaited<ReturnType<typeof getSql>>, ownerId: string, ownerColumn: "user_id" | "visitor_id") {
  const [searches, alerts] = await Promise.all([
    sql.query<Record<string, unknown>>(
      `select client_id, name, params, enabled, updated_at
       from customer_saved_searches
       where ${ownerColumn}=$1 and enabled=true
       order by updated_at desc
       limit 10`,
      [ownerId],
    ),
    sql.query<Record<string, unknown>>(
      `select id::text as id, property_slug, alert_type, title, message, created_at
       from customer_saved_search_alerts
       where ${ownerColumn}=$1 and seen_at is null
       order by created_at desc
       limit 30`,
      [ownerId],
    ),
  ]);

  return {
    searches: searches.map((row) => ({
      clientId: String(row.client_id),
      name: String(row.name),
      params: String(row.params),
      enabled: Boolean(row.enabled),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    })),
    alerts: alerts.map((row) => ({
      id: String(row.id),
      slug: String(row.property_slug),
      type: String(row.alert_type),
      title: String(row.title),
      message: String(row.message),
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertSameOrigin(event);
  const parsed = bodySchema.safeParse(await readBody(event).catch(() => ({})));
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: "درخواست اعلان‌ها نامعتبر است." });
  }
  if (dbSource === "unconfigured") return { enabled: false, searches: [], alerts: [] };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const ownerId = userId ?? visitorId;
  const ownerColumn = userId ? "user_id" : "visitor_id";
  const sql = await getSql();

  if (parsed.data.action === "save") {
    if (!parsed.data.item) throw createError({ statusCode: 400, statusMessage: "جست‌وجویی برای ذخیره ارسال نشده است." });
    await persistItem(sql, visitorId, userId, parsed.data.item);
    await sql.query(
      `delete from customer_saved_searches
       where ${ownerColumn}=$1
         and id not in (
           select id from customer_saved_searches
           where ${ownerColumn}=$1
           order by updated_at desc
           limit 10
         )`,
      [visitorId],
    );
  }

  if (parsed.data.action === "sync") {
    for (const item of parsed.data.items) await persistItem(sql, visitorId, userId, item);
    await sql.query(
      `delete from customer_saved_searches
       where ${ownerColumn}=$1
         and id not in (
           select id from customer_saved_searches
           where ${ownerColumn}=$1
           order by updated_at desc
           limit 10
         )`,
      [ownerId],
    );
  }

  if (parsed.data.action === "delete") {
    if (!parsed.data.clientId) throw createError({ statusCode: 400, statusMessage: "شناسه جست‌وجو مشخص نیست." });
    await sql.query(`delete from customer_saved_searches where ${ownerColumn}=$1 and client_id=$2`, [ownerId, parsed.data.clientId]);
  }

  if (parsed.data.action === "seen" && parsed.data.alertIds.length) {
    await sql.query(`update customer_saved_search_alerts set seen_at=current_timestamp where ${ownerColumn}=$1 and id=any($2::bigint[])`, [ownerId, parsed.data.alertIds]);
  }

  if (parsed.data.action !== "seen") {
    await collectAlerts(sql, ownerId, ownerColumn, userId, visitorId);
  }

  return {
    enabled: true,
    ...(await listData(sql, ownerId, ownerColumn)),
  };
});
