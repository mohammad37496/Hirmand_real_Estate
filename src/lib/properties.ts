import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

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
};

export type PropertyFilters = {
  transactionType?: PropertyTransaction;
  propertyType?: PropertyType;
  neighborhood?: string;
  featuredOnly?: boolean;
};

const publicFiltersSchema = z.object({
  transactionType: z.enum(["buy", "sell", "rent", "mortgage"]).optional(),
  propertyType: z
    .enum(["apartment", "villa", "office", "heritage", "land", "commercial"])
    .optional(),
  neighborhood: z.string().trim().max(80).optional(),
  featuredOnly: z.boolean().optional(),
});

const propertyInputSchema = z.object({
  adminKey: z.string().min(1),
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
  price: z.string().trim().max(30).optional().default(""),
  deposit: z.string().trim().max(30).optional().default(""),
  rent: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().min(10).max(5000),
  features: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  images: z.array(z.string().url()).max(12).default([]),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(8).max(30),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  featured: z.boolean().default(false),
});

const adminKeySchema = z.object({
  adminKey: z.string().min(1),
});

const idSchema = z.object({
  adminKey: z.string().min(1),
  id: z.string().min(1),
});

function requireAdmin(adminKey: string) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected) {
    throw new Error(
      "مدیریت فایل‌ها فعال نشده است. متغیر HIRMAND_ADMIN_KEY را در محیط سرور تنظیم کنید.",
    );
  }
  if (adminKey !== expected) {
    throw new Error("کلید مدیریت فایل‌ها نادرست است.");
  }
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
  };
}

export const listPublishedProperties = createServerFn({ method: "GET" })
  .validator(publicFiltersSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at, created_at, updated_at
      from properties
      where status = 'published'
        and ($1::text is null or transaction_type = $1)
        and ($2::text is null or property_type = $2)
        and ($3::text is null or neighborhood ilike '%' || $3 || '%')
        and ($4::boolean is false or featured = true)
      order by featured desc, published_at desc nulls last, created_at desc
      limit 48`,
      [
        data.transactionType ?? null,
        data.propertyType ?? null,
        data.neighborhood?.trim() || null,
        data.featuredOnly ?? false,
      ],
    );
    return rows.map(mapProperty);
  });

export const getPublishedProperty = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at, created_at, updated_at
      from properties
      where slug = $1 and status = 'published'
      limit 1`,
      [data.slug],
    );
    return rows[0] ? mapProperty(rows[0]) : null;
  });

export const listAdminProperties = createServerFn({ method: "POST" })
  .validator(adminKeySchema)
  .handler(async ({ data }) => {
    requireAdmin(data.adminKey);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at, created_at, updated_at
      from properties
      order by created_at desc
      limit 100`,
    );
    return rows.map(mapProperty);
  });

export const saveProperty = createServerFn({ method: "POST" })
  .validator(propertyInputSchema)
  .handler(async ({ data }) => {
    requireAdmin(data.adminKey);
    const sql = await getSql();

    const id = data.id ?? crypto.randomUUID();
    const slug = `${slugify(data.title)}-${id.slice(0, 8)}`;
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
        description = excluded.description,
        features = excluded.features,
        images = excluded.images,
        contact_name = excluded.contact_name,
        contact_phone = excluded.contact_phone,
        published_at = excluded.published_at,
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
      ],
    );

    const rows = await sql.query<Record<string, unknown>>(
      "select * from properties where id = $1 limit 1",
      [id],
    );
    if (!rows[0]) throw new Error("فایل ثبت نشد.");
    return mapProperty(rows[0]);
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    requireAdmin(data.adminKey);
    const sql = await getSql();
    await sql.query("delete from properties where id = $1", [data.id]);
    return { success: true };
  });
