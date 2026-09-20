import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { calculateBudgetMatch, DEFAULT_MATCH_RAHN_RATE, type BudgetInput, type BudgetMatchDetails } from "@/lib/budget-matching";

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
  priceDropPercent: number | null;
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
> & {
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
  sort: z.enum(["newest", "price_asc", "price_desc", "area_asc", "area_desc"]).optional().default("newest"),
  offset: z.number().int().min(0).max(100000).optional().default(0),
});

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
  price: z.coerce.string().trim().max(30).optional().default(""),
  deposit: z.coerce.string().trim().max(30).optional().default(""),
  rent: z.coerce.string().trim().max(30).optional().default(""),
  description: z.string().trim().min(10).max(5000),
  features: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  images: z.array(z.string().url()).max(12).default([]),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(8).max(30),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  featured: z.boolean().default(false),
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
    priceDropPercent: numberOrNull(row.price_drop_percent),
  };
}

const LIST_COLUMNS = `
  id, slug, status, featured, title, transaction_type, property_type, city,
  neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
  built_year, parking, elevator, storage, price, deposit, rent,
  features, images, contact_name, contact_phone, published_at, created_at, updated_at,
  price_drop_percent,
  left(description, 280) as description
`;

const CARD_COLUMNS = `
  id, slug, status, featured, title, transaction_type, property_type,
  neighborhood, area_m2, bedrooms, parking, elevator, price, deposit, rent,
  nullif(images->>0, '') as image,
  price_drop_percent
`;

function mapPropertyCard(row: Record<string, unknown>): PropertyCardData {
  return {
    id: String(row.id),
    slug: String(row.slug),
    status: row.status as PropertyStatus,
    featured: Boolean(row.featured),
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
  };
}

const DETAIL_COLUMNS = `
  id, slug, status, featured, title, transaction_type, property_type, city,
  neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
  built_year, parking, elevator, storage, price, deposit, rent, description,
  features, images, contact_name, contact_phone, published_at, created_at, updated_at,
  price_drop_percent
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
    "and ($4::boolean is false or featured = true)",
    "and ($6::text is null or title ilike '%' || $6 || '%' or neighborhood ilike '%' || $6 || '%' or address ilike '%' || $6 || '%')",
    "and ($7::int is null or area_m2 >= $7)",
    "and ($8::int is null or area_m2 <= $8)",
    "and ($9::numeric is null or " + PRICE_EXPR + " >= $9)",
    "and ($10::numeric is null or " + PRICE_EXPR + " <= $10)",
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
        "order by case when $12 = 'newest' then case when featured then 0 else 1 end else 0 end,",
        "case when $12 = 'price_asc' then " + PRICE_EXPR + " end asc nulls last,",
        "case when $12 = 'price_desc' then " + PRICE_EXPR + " end desc nulls last,",
        "case when $12 = 'area_asc' then area_m2 end asc nulls last,",
        "case when $12 = 'area_desc' then area_m2 end desc nulls last,",
        "published_at desc nulls last, created_at desc",
        "limit 48 offset $11",
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
        "order by case when $12 = 'newest' then case when featured then 0 else 1 end else 0 end,",
        "case when $12 = 'price_asc' then " + PRICE_EXPR + " end asc nulls last,",
        "case when $12 = 'price_desc' then " + PRICE_EXPR + " end desc nulls last,",
        "case when $12 = 'area_asc' then area_m2 end asc nulls last,",
        "case when $12 = 'area_desc' then area_m2 end desc nulls last,",
        "published_at desc nulls last, created_at desc",
        "limit 48 offset $11",
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
    const params = publicFilterParams(data).slice(0, 10);
    const rows = await sql.query<{ count: number }>(
      "select count(*)::int as count from properties where " + publicPropertyWhereSql(),
      params,
    );
    return Number(rows[0]?.count) || 0;
  });

export const getPublishedProperty = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    if (dbSource === "unconfigured") return null;
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS}
      from properties
      where slug = $1 and status = 'published'
      limit 1`,
      [data.slug],
    );
    return rows[0] ? mapProperty(rows[0]) : null;
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
        "abs(" + totalExpr + " - $4::numeric) asc,",
        "featured desc, published_at desc nulls last, created_at desc",
        "limit $8",
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
        return tierOrder[a.tier] - tierOrder[b.tier] || b.score - a.score;
      });
  });

const adminListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).max(10000).optional().default(0),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const listAdminProperties = createServerFn({ method: "POST" })
  .validator(adminListSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${LIST_COLUMNS}
      from properties
      where ($1::text is null or status = $1)
      order by created_at desc
      limit $2 offset $3`,
      [data.status ?? null, data.limit, data.offset],
    );
    return rows.map(mapProperty);
  });

export const countAdminProperties = createServerFn({ method: "POST" })
  .validator(adminKeySchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") {
      return { total: 0, published: 0, draft: 0, archived: 0 };
    }
    const sql = await getSql();
    const rows = await sql.query<{ status: string; n: number }>(
      `select status, count(*)::int as n from properties group by status`,
    );
    const out = { total: 0, published: 0, draft: 0, archived: 0 };
    for (const row of rows) {
      const n = Number(row.n) || 0;
      out.total += n;
      if (row.status === "published") out.published = n;
      else if (row.status === "draft") out.draft = n;
      else if (row.status === "archived") out.archived = n;
    }
    return out;
  });

export const saveProperty = createServerFn({ method: "POST" })
  .validator(propertyInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();

    const id = data.id ?? crypto.randomUUID();
    const slug = `${slugify(data.title)}-${id.slice(0, 8)}`;

    const existingRows = await sql.query<Record<string, unknown>>(
      "select transaction_type, price, deposit, rent from properties where id = $1 limit 1",
      [id],
    );
    const existing = existingRows[0] ?? null;
    const numeric = (value: unknown) => {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const effectiveValue = (
      transaction: PropertyTransaction | null | undefined,
      price: unknown,
      deposit: unknown,
      rent: unknown,
    ) => {
      if (transaction === "rent") return numeric(rent) ?? numeric(deposit);
      if (transaction === "mortgage") return numeric(deposit);
      return numeric(price);
    };
    const oldValue = existing
      ? effectiveValue(existing.transaction_type as PropertyTransaction, existing.price, existing.deposit, existing.rent)
      : null;
    const newValue = effectiveValue(data.transactionType, data.price, data.deposit, data.rent);
    const dropped = oldValue != null && newValue != null && oldValue > 0 && newValue < oldValue;
    const dropPercent = dropped ? Number((((oldValue - newValue) / oldValue) * 100).toFixed(2)) : null;
    const publishedAt = data.status === "published" ? new Date().toISOString() : null;

    await sql.query(
      `insert into properties (
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, 'اصفهان',
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23::jsonb, $24::jsonb, $25, $26, $27
      )
      on conflict (id) do update set
        slug = excluded.slug,
        status = excluded.status,
        featured = excluded.featured,
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
        previous_price = case when $28 is not null then $28 else properties.previous_price end,
        previous_deposit = case when $29 is not null then $29 else properties.previous_deposit end,
        previous_rent = case when $30 is not null then $30 else properties.previous_rent end,
        price_changed_at = case when $31::numeric is not null then current_timestamp else properties.price_changed_at end,
        price_drop_percent = case when $31::numeric is not null then $31::numeric else null end,
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
        data.price || null,
        data.deposit || null,
        data.rent || null,
        data.description,
        JSON.stringify(data.features),
        JSON.stringify(data.images),
        data.contactName,
        data.contactPhone,
        publishedAt,
        existing?.price ?? null,
        existing?.deposit ?? null,
        existing?.rent ?? null,
        dropPercent,
      ],
    );

    const rows = await sql.query<Record<string, unknown>>(
      `select ${DETAIL_COLUMNS} from properties where id = $1 limit 1`,
      [id],
    );
    if (!rows[0]) throw new Error("فایل ثبت نشد.");
    return mapProperty(rows[0]);
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    await sql.query("delete from properties where id = $1", [data.id]);
    return { success: true };
  });
