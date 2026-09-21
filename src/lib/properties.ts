import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { calculateBudgetMatch, DEFAULT_MATCH_RAHN_RATE, type BudgetInput, type BudgetMatchDetails } from "@/lib/budget-matching";
import { MAX_PROPERTY_MEDIA, isAllowedMediaRef } from "@/lib/media";

export type PropertyStatus = "draft" | "published" | "archived";
export type PropertyTransaction = "buy" | "sell" | "rent" | "mortgage";
export type PropertyType =
  | "apartment"
  | "villa"
  | "office"
  | "heritage"
  | "land"
  | "commercial";

export type Property = {
  id: string;
  slug: string;
  status: PropertyStatus;
  featured: boolean;
  featuredUntil?: string | null;
  title: string;
  transactionType: PropertyTransaction;
  propertyType: PropertyType;
  city: string;
  neighborhood: string;
  address: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  builtYear: number | null;
  parking: boolean;
  elevator: boolean;
  storage: boolean;
  price: string | null;
  deposit: string | null;
  rent: string | null;
  description: string;
  features: string[];
  images: string[];
  contactName: string;
  contactPhone: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latitude: number | null;
  longitude: number | null;
  priceDropPercent?: number | null;
};

export type PropertyHistoryState = {
  title: string | null;
  status: PropertyStatus | null;
  featured: boolean | null;
  price: string | null;
  deposit: string | null;
  rent: string | null;
  contactName: string | null;
  contactPhone: string | null;
};

export type PropertyCardData = Pick<
  Property,
  | "id"
  | "slug"
  | "status"
  | "featured"
  | "title"
  | "transactionType"
  | "propertyType"
  | "neighborhood"
  | "areaM2"
  | "bedrooms"
  | "parking"
  | "elevator"
  | "price"
  | "deposit"
  | "rent"
  | "priceDropPercent"
  | "latitude"
  | "longitude"
> & {
  featuredUntil?: string | null;
  image: string | null;
};

export type PropertySort = "newest" | "price_asc" | "price_desc" | "area_asc" | "area_desc";

export type PropertyFilters = {
  transactionType?: PropertyTransaction;
  propertyType?: PropertyType;
  neighborhood?: string;
  featuredOnly?: boolean;
  search?: string;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  parkingOnly?: boolean;
  elevatorOnly?: boolean;
  sort?: PropertySort;
  offset?: number;
};

const publicFiltersSchema = z.object({
  transactionType: z.enum(["buy", "sell", "rent", "mortgage"]).optional(),
  propertyType: z
    .enum(["apartment", "villa", "office", "heritage", "land", "commercial"])
    .optional(),
  neighborhood: z.string().trim().max(80).optional(),
  featuredOnly: z.boolean().optional(),
  search: z.string().trim().max(80).optional(),
  minArea: z.number().int().min(0).max(100000).optional(),
  maxArea: z.number().int().min(0).max(100000).optional(),
  minPrice: z.number().int().min(0).max(999999999999999).optional(),
  maxPrice: z.number().int().min(0).max(999999999999999).optional(),
  minBedrooms: z.number().int().min(0).max(30).optional(),
  parkingOnly: z.boolean().optional(),
  elevatorOnly: z.boolean().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "area_asc", "area_desc"]).optional().default("newest"),
  offset: z.number().int().min(0).max(100000).optional().default(0),
});

function normalizeMoneyText(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw || /^(null|undefined)$/i.test(raw)) return "";
  return raw
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[,_٬\s]/g, "");
}

const nullableMoneyField = z.preprocess(
  (value) => normalizeMoneyText(value),
  z.union([z.literal(""), z.string().regex(/^\d{1,20}$/)]),
);

const propertyInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(180),
  transactionType: z.enum(["buy", "sell", "rent", "mortgage"]),
  propertyType: z.enum(["apartment", "villa", "office", "heritage", "land", "commercial"]),
  neighborhood: z.string().trim().min(2).max(80),
  address: z.string().trim().max(240).optional().default(""),
  areaM2: z.number().int().min(0).max(100000).nullable().optional(),
  bedrooms: z.number().int().min(0).max(30).nullable().optional(),
  bathrooms: z.number().int().min(0).max(30).nullable().optional(),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  totalFloors: z.number().int().min(0).max(200).nullable().optional(),
  builtYear: z.number().int().min(1200).max(2500).nullable().optional(),
  parking: z.boolean().default(false),
  elevator: z.boolean().default(false),
  storage: z.boolean().default(false),
  price: nullableMoneyField,
  deposit: nullableMoneyField,
  rent: nullableMoneyField,
  description: z.string().trim().min(10).max(5000),
  features: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  images: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(2048)
        .refine(isAllowedMediaRef, { message: "نشانی رسانه نامعتبر است." }),
    )
    .max(MAX_PROPERTY_MEDIA)
    .default([]),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(8).max(30),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  featured: z.boolean().default(false),
  featuredUntil: z.string().trim().max(80).nullable().optional().default(null),
});

const budgetMatchSchema = z
  .object({
    depositBudget: z.number().int().min(0).max(999999999999999),
    rentBudget: z.number().int().min(0).max(999999999999999),
    propertyType: z
      .enum(["apartment", "villa", "office", "heritage", "land", "commercial"])
      .optional(),
    neighborhood: z.string().trim().max(80).optional(),
    bedrooms: z.number().int().min(1).max(30).optional(),
    limit: z.number().int().min(1).max(24).optional().default(12),
  })
  .refine((value) => value.depositBudget > 0 || value.rentBudget > 0, {
    message: "حداقل یکی از مبالغ بودجه باید بیشتر از صفر باشد.",
  });

const adminKeySchema = z.object({});

const idSchema = z.object({
  id: z.string().min(1),
});

async function requireAdmin() {
  const session = getCookie(ADMIN_SESSION_COOKIE);
  if (await verifyAdminSessionToken(session)) return;

  throw new Error("نشست مدیریت معتبر نیست. دوباره وارد پنل شوید.");
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "property";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isFeaturedActive(property: { featured: boolean; featuredUntil?: string | null }) {
  return property.featured && (!property.featuredUntil || new Date(property.featuredUntil).getTime() >= Date.now());
}

function numericStringOrNull(value: unknown): string | null {
  const normalized = normalizeMoneyText(value);
  return normalized || null;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function mapProperty(row: Record<string, unknown>): Property {
  return {
    id: String(row.id),
    slug: String(row.slug),
    status: row.status as PropertyStatus,
    featured: Boolean(row.featured),
    featuredUntil: row.featured_until ? new Date(String(row.featured_until)).toISOString() : null,
    title: String(row.title),
    transactionType: row.transaction_type as PropertyTransaction,
    propertyType: row.property_type as PropertyType,
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    address: row.address ? String(row.address) : null,
    areaM2: numberOrNull(row.area_m2),
    bedrooms: numberOrNull(row.bedrooms),
    bathrooms: numberOrNull(row.bathrooms),
    floor: numberOrNull(row.floor),
    totalFloors: numberOrNull(row.total_floors),
    builtYear: numberOrNull(row.built_year),
    parking: Boolean(row.parking),
    elevator: Boolean(row.elevator),
    storage: Boolean(row.storage),
    price: row.price == null ? null : String(row.price),
    deposit: row.deposit == null ? null : String(row.deposit),
    rent: row.rent == null ? null : String(row.rent),
    description: String(row.description),
    features: parseJsonArray(row.features),
    images: parseJsonArray(row.images),
    contactName: String(row.contact_name),
    contactPhone: String(row.contact_phone),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    priceDropPercent: numberOrNull(row.price_drop_percent),
  };
}

const LIST_COLUMNS = `
  id, slug, status, featured, featured_until, title, transaction_type, property_type, city,
  neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
  built_year, parking, elevator, storage, price, deposit, rent,
  features, images, contact_name, contact_phone, published_at, created_at, updated_at,
  latitude, longitude, price_drop_percent,
  left(description, 280) as description
`;

const CARD_COLUMNS = `
  id, slug, status, featured, featured_until, title, transaction_type, property_type,
  neighborhood, area_m2, bedrooms, parking, elevator, price, deposit, rent,
  nullif(images->>0, '') as image,
  price_drop_percent,
  latitude, longitude
`;

function mapPropertyCard(row: Record<string, unknown>): PropertyCardData {
  return {
    id: String(row.id),
    slug: String(row.slug),
    status: row.status as PropertyStatus,
    featured: Boolean(row.featured),
    featuredUntil: row.featured_until ? new Date(String(row.featured_until)).toISOString() : null,
    title: String(row.title),
    transactionType: row.transaction_type as PropertyTransaction,
    propertyType: row.property_type as PropertyType,
    neighborhood: String(row.neighborhood),
    areaM2: numberOrNull(row.area_m2),
    bedrooms: numberOrNull(row.bedrooms),
    parking: Boolean(row.parking),
    elevator: Boolean(row.elevator),
    price: row.price == null ? null : String(row.price),
    deposit: row.deposit == null ? null : String(row.deposit),
    rent: row.rent == null ? null : String(row.rent),
    image: row.image ? String(row.image) : null,
    priceDropPercent: numberOrNull(row.price_drop_percent),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
  };
}

const DETAIL_COLUMNS = `
  id, slug, status, featured, featured_until, title, transaction_type, property_type, city,
  neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
  built_year, parking, elevator, storage, price, deposit, rent, description,
  features, images, contact_name, contact_phone, published_at, created_at, updated_at,
  latitude, longitude, price_drop_percent
`;

function publicFilterParams(data: z.infer<typeof publicFiltersSchema>) {
  const neighborhood = data.neighborhood?.trim() || null;
  const exactNeighborhood = Boolean(
    neighborhood && neighborhood.length >= 2 && !neighborhood.includes("%"),
  );
  return [
    data.transactionType ?? null,
    data.propertyType ?? null,
    neighborhood,
    data.featuredOnly ?? false,
    exactNeighborhood,
    data.search?.trim() || null,
    data.minArea ?? null,
    data.maxArea ?? null,
    data.minPrice ?? null,
    data.maxPrice ?? null,
    data.minBedrooms ?? null,
    data.parkingOnly ?? false,
    data.elevatorOnly ?? false,
    data.offset ?? 0,
  ];
}

const PRICE_EXPR =
  "case when transaction_type = 'rent' then coalesce(rent, deposit) " +
  "when transaction_type = 'mortgage' then deposit else price end";

function publicPropertyWhereSql() {
  return [
    "status = 'published'",
    "and ($1::text is null or transaction_type = $1)",
    "and ($2::text is null or property_type = $2)",
    "and ($3::text is null or ($5::boolean is true and neighborhood = $3) or ($5::boolean is false and neighborhood ilike '%' || $3 || '%'))",
    "and ($4::boolean is false or (featured = true and (featured_until is null or featured_until >= current_timestamp)))",
    "and ($6::text is null or title ilike '%' || $6 || '%' or neighborhood ilike '%' || $6 || '%' or address ilike '%' || $6 || '%')",
    "and ($7::int is null or area_m2 >= $7)",
    "and ($8::int is null or area_m2 <= $8)",
    "and ($9::numeric is null or " + PRICE_EXPR + " >= $9)",
    "and ($10::numeric is null or " + PRICE_EXPR + " <= $10)",
    "and ($11::int is null or bedrooms >= $11)",
    "and ($12::boolean is false or parking = true)",
    "and ($13::boolean is false or elevator = true)",
  ].join(" ");
}

export const listPublishedPropertyCards = createServerFn({ method: "GET" })
  .validator(publicFiltersSchema)
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const params = publicFilterParams(data);
    const rows = await sql.query<Record<string, unknown>>(
      [
        "select " + CARD_COLUMNS,
        "from properties where " + publicPropertyWhereSql(),
        "order by case when $15 = 'newest' then case when featured and (featured_until is null or featured_until >= current_timestamp) then 0 else 1 end else 0 end,",
        "case when $15 = 'price_asc' then " + PRICE_EXPR + " end asc nulls last,",
        "case when $15 = 'price_desc' then " + PRICE_EXPR + " end desc nulls last,",
        "case when $15 = 'area_asc' then area_m2 end asc nulls last,",
        "case when $15 = 'area_desc' then area_m2 end desc nulls last,",
        "published_at desc nulls last, created_at desc",
        "limit 48 offset $14",
      ].join(" "),
      [...params, data.sort],
    );
    return rows.map(mapPropertyCard);
  });

export const listPublishedProperties = createServerFn({ method: "GET" })
  .validator(publicFiltersSchema)
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const params = publicFilterParams(data);
    const rows = await sql.query<Record<string, unknown>>(
      [
        "select " + LIST_COLUMNS,
        "from properties where " + publicPropertyWhereSql(),
        "order by case when $15 = 'newest' then case when featured then 0 else 1 end else 0 end,",
        "case when $15 = 'price_asc' then " + PRICE_EXPR + " end asc nulls last,",
        "case when $15 = 'price_desc' then " + PRICE_EXPR + " end desc nulls last,",
        "case when $15 = 'area_asc' then area_m2 end asc nulls last,",
        "case when $15 = 'area_desc' then area_m2 end desc nulls last,",
        "published_at desc nulls last, created_at desc",
        "limit 48 offset $14",
      ].join(" "),
      [...params, data.sort],
    );
    return rows.map(mapProperty);
  });

export const countPublishedProperties = createServerFn({ method: "GET" })
  .validator(publicFiltersSchema)
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return 0;
    const sql = await getSql();
    const params = publicFilterParams(data).slice(0, 13);
    const rows = await sql.query<{ count: number }>(
      "select count(*)::int as count from properties where " + publicPropertyWhereSql(),
      params,
    );
    return Number(rows[0]?.count) || 0;
  });

export const listPublishedPropertiesByContact = createServerFn({ method: "GET" })
  .validator(z.object({ phone: z.string().trim().min(8).max(30) }))
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS}
       from properties
       where status = 'published' and contact_phone = $1
       order by featured desc, published_at desc nulls last, created_at desc
       limit 48`,
      [data.phone],
    );
    return rows.map(mapProperty);
  });

export const getPublishedPropertyById = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return null;
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS}
       from properties
       where status = 'published' and id::text = $1
       limit 1`,
      [data.id],
    );
    return rows[0] ? mapProperty(rows[0]) : null;
  });

export const getPublishedProperty = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return null;
    const sql = await getSql();

    const decodedCandidates = [data.slug];
    for (let i = 0; i < 2; i += 1) {
      const current = decodedCandidates[decodedCandidates.length - 1];
      try {
        const decoded = decodeURIComponent(current);
        if (decoded !== current && !decodedCandidates.includes(decoded)) {
          decodedCandidates.push(decoded);
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS}
       from properties
       where status = 'published'
         and (
           slug = any($1::text[])
           or id::text = any($1::text[])
         )
       order by case when slug = $2 then 0 when slug = $3 then 1 else 2 end
       limit 1`,
      [decodedCandidates, decodedCandidates[0], decodedCandidates[1] ?? decodedCandidates[0]],
    );

    return rows[0] ? mapProperty(rows[0]) : null;
  });

export const listPublishedPropertyCardsBySlugs = createServerFn({ method: "GET" })
  .validator(z.object({
    slugs: z.array(z.string().trim().min(1).max(220)).max(8),
  }))
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured" || data.slugs.length === 0) return [];
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${CARD_COLUMNS}
       from properties
       where status = 'published'
         and slug = any($1::text[])
       order by featured desc, published_at desc nulls last, created_at desc`,
      [data.slugs],
    );
    const bySlug = new Map(rows.map((row) => [String(row.slug), mapPropertyCard(row)]));
    return data.slugs.map((slug) => bySlug.get(slug)).filter((property): property is PropertyCardData => Boolean(property));
  });

export const listPublishedPropertiesBySlugs = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slugs: z.array(z.string().trim().min(1).max(220)).max(100),
    }),
  )
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured" || data.slugs.length === 0) return [];

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS}
       from properties
       where status = 'published'
         and slug = any($1::text[])
       order by featured desc, published_at desc nulls last, created_at desc`,
      [data.slugs],
    );

    const bySlug = new Map(rows.map((row) => [String(row.slug), mapProperty(row)]));
    return data.slugs
      .map((slug) => bySlug.get(slug))
      .filter((property): property is Property => Boolean(property));
  });

export const listRelatedProperties = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z.string().min(1),
      neighborhood: z.string().trim().min(1).max(80),
      propertyType: z.enum([
        "apartment",
        "villa",
        "office",
        "heritage",
        "land",
        "commercial",
      ]),
      limit: z.number().int().min(1).max(12).optional().default(6),
    }),
  )
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${LIST_COLUMNS}
       from properties
       where status = 'published'
         and slug <> $1
         and (
           neighborhood = $2
           or property_type = $3
         )
       order by
         case when neighborhood = $2 then 0 else 1 end,
         case when featured then 0 else 1 end,
         published_at desc nulls last,
         created_at desc
       limit $4`,
      [data.slug, data.neighborhood, data.propertyType, data.limit],
    );
    return rows.map(mapProperty);
  });

export type PropertyBudgetMatch = BudgetMatchDetails & {
  property: Property;
};

export const matchPublishedPropertiesByBudget = createServerFn({ method: "GET" })
  .validator(budgetMatchSchema)
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return [];

    const sql = await getSql();
    const rate = DEFAULT_MATCH_RAHN_RATE;
    const budgetTotal = data.depositBudget + (data.rentBudget * 1_000_000) / rate;
    const totalExpr =
      "(coalesce(deposit, 0)::numeric + (coalesce(rent, 0)::numeric * 1000000 / $1::numeric))";

    const rows = await sql.query<Record<string, unknown>>(
      [
        "select " + DETAIL_COLUMNS,
        "from properties",
        "where status = 'published'",
        "and transaction_type in ('rent', 'mortgage')",
        "and (coalesce(deposit, 0) > 0 or coalesce(rent, 0) > 0)",
        "and ($5::text is null or property_type = $5)",
        "and ($6::text is null or neighborhood = $6 or neighborhood ilike '%' || $6 || '%')",
        "and ($7::int is null or bedrooms >= $7)",
        "and " + totalExpr + " <= $4::numeric * 1.15",
        "order by",
        "case",
        "  when coalesce(deposit, 0) <= $2 and coalesce(rent, 0) <= $3 then 0",
        "  when " + totalExpr + " <= $4::numeric then 1",
        "  else 2",
        "end asc,",
        "case when featured and (featured_until is null or featured_until >= current_timestamp) then 0 else 1 end asc,",
        "abs(" + totalExpr + " - $4::numeric) asc,",
        "published_at desc nulls last, created_at desc",
        "limit greatest($8, 36)",
      ].join(" "),
      [
        rate,
        data.depositBudget,
        data.rentBudget,
        budgetTotal,
        data.propertyType ?? null,
        data.neighborhood?.trim() || null,
        data.bedrooms ?? null,
        data.limit,
      ],
    );

    const budget: BudgetInput = {
      depositBudget: data.depositBudget,
      rentBudget: data.rentBudget,
    };

    return rows
      .map(mapProperty)
      .map((property) => {
        const details = calculateBudgetMatch(property, budget, rate);
        return details ? { property, ...details } : null;
      })
      .filter((match): match is PropertyBudgetMatch => Boolean(match))
      .sort((a, b) => {
        const tierOrder = { within: 0, convertible: 1, near: 2 } as const;
        return tierOrder[a.tier] - tierOrder[b.tier]
          || b.score - a.score
          || a.gapEquivalent - b.gapEquivalent;
      })
      .slice(0, data.limit);
  });

const adminListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).max(100000).optional().default(0),
  status: z.enum(["draft", "published", "archived"]).optional(),
  transactionType: z.enum(["buy", "sell", "rent", "mortgage"]).optional(),
  propertyType: z.enum(["apartment", "villa", "office", "heritage", "land", "commercial"]).optional(),
  neighborhood: z.string().trim().max(80).optional(),
  featuredOnly: z.boolean().optional().default(false),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "title", "price_desc"]).optional().default("newest"),
});

const adminBulkSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(160)).min(1).max(2000),
});

const adminBulkStatusSchema = adminBulkSchema.extend({
  status: z.enum(["draft", "published", "archived"]),
});

const adminBulkFeaturedSchema = adminBulkSchema.extend({
  featured: z.boolean(),
});

const adminBulkConsultantSchema = adminBulkSchema.extend({
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(8).max(30),
});

function adminFilterParams(data: z.infer<typeof adminListSchema>) {
  return [
    data.status ?? null,
    data.transactionType ?? null,
    data.propertyType ?? null,
    data.neighborhood?.trim() || null,
    data.featuredOnly ?? false,
    data.search?.trim() || null,
  ];
}

function adminPropertyWhereSql() {
  return [
    "($1::text is null or status = $1)",
    "and ($2::text is null or transaction_type = $2)",
    "and ($3::text is null or property_type = $3)",
    "and ($4::text is null or neighborhood = $4)",
    "and ($5::boolean is false or (featured = true and (featured_until is null or featured_until >= current_timestamp)))",
    "and ($6::text is null or title ilike '%' || $6 || '%' or neighborhood ilike '%' || $6 || '%' or coalesce(address, '') ilike '%' || $6 || '%' or contact_name ilike '%' || $6 || '%' or contact_phone ilike '%' || $6 || '%' or id ilike '%' || $6 || '%')",
  ].join(" ");
}

const ADMIN_PRICE_EXPR =
  "case when transaction_type = 'rent' then coalesce(rent, deposit) " +
  "when transaction_type = 'mortgage' then deposit else price end";

export const listAdminProperties = createServerFn({ method: "POST" })
  .validator(adminListSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const filters = adminFilterParams(data);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${LIST_COLUMNS}
       from properties
       where ${adminPropertyWhereSql()}
       order by
         case when $7 = 'title' then title end asc nulls last,
         case when $7 = 'price_desc' then ${ADMIN_PRICE_EXPR} end desc nulls last,
         updated_at desc,
         created_at desc
       limit $8 offset $9`,
      [...filters, data.sort, data.limit, data.offset],
    );
    return rows.map(mapProperty);
  });

export const countAdminProperties = createServerFn({ method: "POST" })
  .validator(adminKeySchema)
  .handler(async () => {
    await requireAdmin();
    if (dbSource === "unconfigured") {
      return { total: 0, published: 0, draft: 0, archived: 0, featured: 0 };
    }
    const sql = await getSql();
    const rows = await sql.query<{
      total: number;
      published: number;
      draft: number;
      archived: number;
      featured: number;
    }>(
      `select
         count(*)::int as total,
         count(*) filter (where status = 'published')::int as published,
         count(*) filter (where status = 'draft')::int as draft,
         count(*) filter (where status = 'archived')::int as archived,
         count(*) filter (where featured = true and (featured_until is null or featured_until >= current_timestamp))::int as featured
       from properties`,
    );
    const row = rows[0];
    return {
      total: Number(row?.total) || 0,
      published: Number(row?.published) || 0,
      draft: Number(row?.draft) || 0,
      archived: Number(row?.archived) || 0,
      featured: Number(row?.featured) || 0,
    };
  });

export const countFilteredAdminProperties = createServerFn({ method: "POST" })
  .validator(adminListSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") return 0;
    const sql = await getSql();
    const rows = await sql.query<{ count: number }>(
      `select count(*)::int as count
       from properties
       where ${adminPropertyWhereSql()}`,
      adminFilterParams(data),
    );
    return Number(rows[0]?.count) || 0;
  });

export const bulkUpdatePropertyStatus = createServerFn({ method: "POST" })
  .validator(adminBulkStatusSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update properties
       set status = $1,
           published_at = case
             when $1 = 'published' then coalesce(published_at, current_timestamp)
             else null
           end,
           updated_at = current_timestamp
       where id = any($2::text[])
       returning id`,
      [data.status, data.ids],
    );
    if (rows.length) {
      await sql.query(
        `insert into property_change_history (property_id, action, before_state, after_state)
         select id, 'updated', null, jsonb_build_object('status', $1)
         from properties
         where id = any($2::text[])`,
        [data.status, data.ids],
      );
    }
    return { success: true, updated: rows.length };
  });

export const bulkSetPropertyFeatured = createServerFn({ method: "POST" })
  .validator(adminBulkFeaturedSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update properties
       set featured = $1,
           featured_until = case when $1 then null else null end,
           updated_at = current_timestamp
       where id = any($2::text[])
       returning id`,
      [data.featured, data.ids],
    );
    if (rows.length) {
      await sql.query(
        `insert into property_change_history (property_id, action, before_state, after_state)
         select id, 'updated', null, jsonb_build_object('featured', $1)
         from properties
         where id = any($2::text[])`,
        [data.featured, data.ids],
      );
    }
    return { success: true, updated: rows.length };
  });

export const bulkAssignPropertyConsultant = createServerFn({ method: "POST" })
  .validator(adminBulkConsultantSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update properties
       set contact_name = $1,
           contact_phone = $2,
           updated_at = current_timestamp
       where id = any($3::text[])
       returning id`,
      [data.contactName, data.contactPhone, data.ids],
    );
    if (rows.length) {
      await sql.query(
        `insert into property_change_history (property_id, action, before_state, after_state)
         select id, 'updated', null, jsonb_build_object('contactName', $1, 'contactPhone', $2)
         from properties
         where id = any($3::text[])`,
        [data.contactName, data.contactPhone, data.ids],
      );
    }
    return { success: true, updated: rows.length };
  });

export const bulkDeleteProperties = createServerFn({ method: "POST" })
  .validator(adminBulkSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      "delete from properties where id = any($1::text[]) returning id",
      [data.ids],
    );
    return { success: true, deleted: rows.length };
  });

export const saveProperty = createServerFn({ method: "POST" })
  .validator(propertyInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();

    const id = data.id ?? crypto.randomUUID();
    const existingRows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS} from properties where id = $1 limit 1`,
      [id],
    );
    const existing = existingRows[0] ?? null;
    const existingSlug = typeof existing?.slug === "string" ? existing.slug.trim() : "";
    const slug = existingSlug || `${slugify(data.title)}-${id.slice(0, 8)}`;
    const price = numericStringOrNull(data.price);
    const deposit = numericStringOrNull(data.deposit);
    const rent = numericStringOrNull(data.rent);
    const featuredUntil = data.featured && data.featuredUntil
      ? (() => {
          const parsed = new Date(data.featuredUntil!);
          if (!Number.isFinite(parsed.getTime())) {
            throw new Error("تاریخ پایان ویژه نامعتبر است.");
          }
          return parsed.toISOString();
        })()
      : null;

    const publishedAt = data.status === "published" ? new Date().toISOString() : null;

    await sql.query(
      `insert into properties (
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at, featured_until
      ) values (
        $1, $2, $3, $4, $5, $6, $7, 'اصفهان',
        $8, $9, $10::integer, $11::smallint, $12::smallint, $13::smallint, $14::smallint,
        $15::smallint, $16::boolean, $17::boolean, $18::boolean, $19::numeric, $20::numeric, $21::numeric, $22::text,
        $23::jsonb, $24::jsonb, $25::text, $26::text, $27::timestamptz, $28::timestamptz
      )
      on conflict (id) do update set
        slug = excluded.slug,
        status = excluded.status,
        featured = excluded.featured,
        featured_until = excluded.featured_until,
        title = excluded.title,
        transaction_type = excluded.transaction_type,
        property_type = excluded.property_type,
        neighborhood = excluded.neighborhood,
        address = excluded.address,
        area_m2 = excluded.area_m2,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        floor = excluded.floor,
        total_floors = excluded.total_floors,
        built_year = excluded.built_year,
        parking = excluded.parking,
        elevator = excluded.elevator,
        storage = excluded.storage,
        price = excluded.price,
        deposit = excluded.deposit,
        rent = excluded.rent,
        previous_price = properties.price,
        previous_deposit = properties.deposit,
        previous_rent = properties.rent,
        price_changed_at = case
          when (
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          ) is not null
          and (
            case
              when excluded.transaction_type = 'rent' then coalesce(excluded.rent, excluded.deposit)
              when excluded.transaction_type = 'mortgage' then excluded.deposit
              else excluded.price
            end
          ) is not null
          and (
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          ) > 0
          and (
            case
              when excluded.transaction_type = 'rent' then coalesce(excluded.rent, excluded.deposit)
              when excluded.transaction_type = 'mortgage' then excluded.deposit
              else excluded.price
            end
          ) < (
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          )
          then current_timestamp
          else properties.price_changed_at
        end,
        price_drop_percent = case
          when (
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          ) > 0
          and (
            case
              when excluded.transaction_type = 'rent' then coalesce(excluded.rent, excluded.deposit)
              when excluded.transaction_type = 'mortgage' then excluded.deposit
              else excluded.price
            end
          ) < (
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          )
          then round((
            (
              case
                when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
                when properties.transaction_type = 'mortgage' then properties.deposit
                else properties.price
              end
            ) - (
              case
                when excluded.transaction_type = 'rent' then coalesce(excluded.rent, excluded.deposit)
                when excluded.transaction_type = 'mortgage' then excluded.deposit
                else excluded.price
              end
            )
          ) / nullif((
            case
              when properties.transaction_type = 'rent' then coalesce(properties.rent, properties.deposit)
              when properties.transaction_type = 'mortgage' then properties.deposit
              else properties.price
            end
          ), 0) * 100, 2)
          else null
        end,
        description = excluded.description,
        features = excluded.features,
        images = excluded.images,
        contact_name = excluded.contact_name,
        contact_phone = excluded.contact_phone,
        published_at = case
          when excluded.status = 'published' and properties.published_at is null then excluded.published_at
          when excluded.status <> 'published' then null
          else properties.published_at
        end,
        updated_at = current_timestamp`,
      [
        id,
        slug,
        data.status,
        data.featured,
        data.title,
        data.transactionType,
        data.propertyType,
        data.neighborhood,
        data.address || null,
        data.areaM2 ?? null,
        data.bedrooms ?? null,
        data.bathrooms ?? null,
        data.floor ?? null,
        data.totalFloors ?? null,
        data.builtYear ?? null,
        data.parking,
        data.elevator,
        data.storage,
        price,
        deposit,
        rent,
        data.description,
        JSON.stringify(data.features),
        JSON.stringify(data.images),
        data.contactName,
        data.contactPhone,
        publishedAt,
        featuredUntil,
      ],
    );

    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS} from properties where id = $1 limit 1`,
      [id],
    );
    if (!rows[0]) throw new Error("فایل ثبت نشد.");

    const action = existing ? "updated" : "created";
    await sql.query(
      `insert into property_change_history (property_id, action, before_state, after_state)
       values ($1, $2, $3::jsonb, $4::jsonb)`,
      [
        id,
        action,
        existing ? JSON.stringify(mapProperty(existing)) : null,
        JSON.stringify(mapProperty(rows[0])),
      ],
    );

    return mapProperty(rows[0]);
  });

export const listPropertyChangeHistory = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().min(1),
    limit: z.number().int().min(1).max(30).optional().default(12),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const rows = await sql.query<{
      id: number;
      action: "created" | "updated" | "deleted";
      before_state: unknown;
      after_state: unknown;
      changed_at: string | Date;
    }>(
      `select id, action, before_state, after_state, changed_at
       from property_change_history
       where property_id = $1
       order by changed_at desc, id desc
       limit $2`,
      [data.id, data.limit],
    );

    const state = (value: unknown): PropertyHistoryState => {
      if (!value || typeof value !== "object") {
        return {
          title: null,
          status: null,
          featured: null,
          price: null,
          deposit: null,
          rent: null,
          contactName: null,
          contactPhone: null,
        };
      }
      const row = value as Record<string, unknown>;
      return {
        title: typeof row.title === "string" ? row.title : null,
        status:
          row.status === "draft" || row.status === "published" || row.status === "archived"
            ? row.status
            : null,
        featured: typeof row.featured === "boolean" ? row.featured : null,
        price: row.price == null ? null : String(row.price),
        deposit: row.deposit == null ? null : String(row.deposit),
        rent: row.rent == null ? null : String(row.rent),
        contactName: typeof row.contactName === "string" ? row.contactName : null,
        contactPhone: typeof row.contactPhone === "string" ? row.contactPhone : null,
      };
    };

    return rows.map((row) => {
      const before = state(row.before_state);
      const after = state(row.after_state);
      return {
        id: Number(row.id),
        action: row.action,
        changedAt: new Date(String(row.changed_at)).toISOString(),
        beforeTitle: before.title,
        beforeStatus: before.status,
        beforeFeatured: before.featured,
        beforePrice: before.price,
        beforeDeposit: before.deposit,
        beforeRent: before.rent,
        beforeContactName: before.contactName,
        beforeContactPhone: before.contactPhone,
        afterTitle: after.title,
        afterStatus: after.status,
        afterFeatured: after.featured,
        afterPrice: after.price,
        afterDeposit: after.deposit,
        afterRent: after.rent,
        afterContactName: after.contactName,
        afterContactPhone: after.contactPhone,
      };
    });
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const existingRows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS} from properties where id = $1 limit 1`,
      [data.id],
    );
    const existing = existingRows[0] ?? null;
    await sql.query("delete from properties where id = $1", [data.id]);

    if (existing) {
      await sql.query(
        `insert into property_change_history (property_id, action, before_state, after_state)
         values ($1, 'deleted', $2::jsonb, null)`,
        [data.id, JSON.stringify(mapProperty(existing))],
      );
    }

    return { success: true };
  });
