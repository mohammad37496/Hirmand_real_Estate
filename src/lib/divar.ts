import { put } from "@vercel/blob";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { SITE, TEAM } from "@/lib/site";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

const DIVAR_API = "https://api.divar.ir/v8";
const DIVAR_WEB = "https://divar.ir";
const CITY_SLUG = "isfahan";
const CATEGORIES = [
  "apartment-sell",
  "house-villa-sell",
  "apartment-rent",
  "house-villa-rent",
] as const;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const DETAIL_BATCH = 4;
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export type DivarTransaction = "sell" | "rent";
export type DivarPropertyType = "apartment" | "villa";
export type DivarFilterStatus = "accepted" | "imported";

export type DivarFile = {
  id: string;
  token: string;
  title: string;
  transactionType: DivarTransaction;
  propertyType: DivarPropertyType;
  neighborhood: string;
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
  sellerName: string | null;
  sellerType: string | null;
  sourceUrl: string;
  filterStatus: DivarFilterStatus;
  importedPropertyId: string | null;
  importedAt: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DivarStats = {
  accepted: number;
  imported: number;
  rejected: number;
  totalSeen: number;
  lastSyncAt: string | null;
};

type ListingCandidate = {
  token: string;
  category: (typeof CATEGORIES)[number];
  webInfo: Record<string, unknown>;
};

type ParsedListing = Omit<
  DivarFile,
  | "id"
  | "filterStatus"
  | "importedPropertyId"
  | "importedAt"
  | "lastSeenAt"
  | "createdAt"
  | "updatedAt"
>;

const adminInput = z.object({}).optional();

function requireAdminSync() {
  return getCookie(ADMIN_SESSION_COOKIE);
}

async function requireAdmin() {
  if (await verifyAdminSessionToken(requireAdminSync())) return;
  throw new Error("نشست مدیریت معتبر نیست. دوباره وارد پنل شوید.");
}

function faToEn(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function normalizeDivarText(value: unknown): string {
  return String(value ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[\u200c\u200d\u200e\u200f\u0640]/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[\u00a0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 9 || out.length > 4000) return out;
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out, depth + 1);
    }
  }
  return out;
}

function collectMediaUrls(value: unknown, out: string[] = [], keyHint = "", depth = 0): string[] {
  if (depth > 10 || out.length >= 48) return out;
  if (typeof value === "string") {
    if (
      /^https?:\/\//i.test(value) &&
      (value.includes("divarcdn.com") || /\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i.test(value))
    ) {
      const looksMediaKey = /image|photo|picture|thumbnail|media|gallery|cover|url/i.test(keyHint);
      if (looksMediaKey || value.includes("divarcdn.com")) out.push(value);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaUrls(item, out, keyHint, depth + 1);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collectMediaUrls(item, out, key, depth + 1);
    }
  }
  return out;
}

function firstStringByKey(value: unknown, pattern: RegExp, depth = 0): string | null {
  if (depth > 10) return null;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (pattern.test(key) && typeof item === "string" && item.trim()) return item.trim();
      const nested = firstStringByKey(item, pattern, depth + 1);
      if (nested) return nested;
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstStringByKey(item, pattern, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function getDivarAgencyReason(value: unknown): string | null {
  const strings = collectStrings(value);
  const normalizedPieces = strings
    .map(normalizeDivarText)
    .filter(Boolean);

  const all = normalizedPieces.join("\n");

  if (all.includes("real-estate-business")) {
    return "نوع آگهی‌دهنده در داده دیوار «مشاور املاک» تشخیص داده شد.";
  }

  if (
    /مشاور.{0,24}املاک.{0,40}(تماس نگیرید|تماس نگیرد|تماس نزن|زنگ نزن)/u.test(all) ||
    /(تماس نگیرید|تماس نگیرد).{0,30}مشاور.{0,24}املاک/u.test(all)
  ) {
    return "عبارت مربوط به «مشاور املاک» یا منع تماس با مشاور در آگهی دیده شد.";
  }

  if (
    all.includes("مشاوراملاک") ||
    all.includes("مشاور املاک") ||
    all.includes("دفتراملاک") ||
    all.includes("دفتر املاک") ||
    all.includes("بنگاهاملاک") ||
    all.includes("بنگاه املاک") ||
    all.includes("آژانساملاک") ||
    all.includes("آژانس املاک")
  ) {
    return "نشانه صریح فعالیت مشاور/دفتر املاک در متن آگهی دیده شد.";
  }

  for (const piece of normalizedPieces) {
    const compact = piece.replace(/\s+/g, "");
    if (
      /^(املاک|اژانس|آژانس|بنگاه)[\p{L}\p{N}]+/u.test(compact) ||
      /^(املاک|اژانس|آژانس|بنگاه)[\s:：-]+[\p{L}\p{N}]/u.test(piece)
    ) {
      return "نام تجاری با الگوی «املاک ...» یا «آژانس ...» در اطلاعات آگهی دیده شد.";
    }
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  const s = faToEn(String(value ?? "")).replace(/[٬،,]/g, "").replace(/\s+/g, " ").trim();
  const match = s.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseMoney(value: unknown): number | null {
  const raw = normalizeDivarText(value);
  if (!raw) return null;
  const normalized = faToEn(raw).replace(/[٬،,]/g, "");
  const matches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?/g)];
  if (!matches.length) return null;

  let total = 0;
  let used = false;
  for (const match of matches) {
    const n = Number(match[1]);
    if (!Number.isFinite(n)) continue;
    const unit = match[2];
    const multiplier = unit === "میلیارد" ? 1_000_000_000 : unit === "میلیون" ? 1_000_000 : unit === "هزار" ? 1_000 : 1;
    total += n * multiplier;
    used = true;
    if (!unit) break;
  }
  return used && total > 0 ? Math.round(total) : null;
}

function compactKey(value: unknown) {
  return normalizeDivarText(value).replace(/\s+/g, "");
}

function walkWidgets(value: unknown, visit: (widget: Record<string, unknown>) => void, depth = 0) {
  if (depth > 12 || !value) return;
  if (Array.isArray(value)) {
    for (const item of value) walkWidgets(item, visit, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  if (typeof obj.widget_type === "string" && obj.data && typeof obj.data === "object") {
    visit(obj);
  }
  for (const item of Object.values(obj)) walkWidgets(item, visit, depth + 1);
}

function findModalWidgets(value: unknown, out: unknown[] = [], depth = 0) {
  if (depth > 12 || !value) return out;
  if (Array.isArray(value)) {
    for (const item of value) findModalWidgets(item, out, depth + 1);
    return out;
  }
  if (typeof value !== "object") return out;
  const obj = value as Record<string, unknown>;
  const modal = obj.modal_page;
  if (modal && typeof modal === "object") {
    const m = modal as Record<string, unknown>;
    if (m.title === "ویژگی‌ها و امکانات" && Array.isArray(m.widget_list)) {
      out.push(...m.widget_list);
    }
  }
  for (const item of Object.values(obj)) findModalWidgets(item, out, depth + 1);
  return out;
}

function parseDivarListing(
  detail: Record<string, unknown>,
  webInfo: Record<string, unknown>,
  category: (typeof CATEGORIES)[number],
  token: string,
): ParsedListing {
  const specs = new Map<string, string>();
  const featureTexts: string[] = [];
  const descriptions: string[] = [];

  const visit = (widget: Record<string, unknown>) => {
    const widgetType = String(widget.widget_type ?? "");
    const data = (widget.data ?? {}) as Record<string, unknown>;

    if (widgetType === "GROUP_INFO_ROW") {
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (row.title && row.value) specs.set(normalizeDivarText(row.title), String(row.value));
      }
    }

    if (widgetType === "UNEXPANDABLE_ROW") {
      if (data.title && data.value) specs.set(normalizeDivarText(data.title), String(data.value));
    }

    if (widgetType === "FEATURE_ROW" || widgetType === "GROUP_FEATURE_ROW") {
      const items = widgetType === "GROUP_FEATURE_ROW" && Array.isArray(data.items) ? data.items : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (row.title) featureTexts.push(String(row.title));
      }
    }

    if (widgetType === "DESCRIPTION_ROW" && data.text) {
      descriptions.push(String(data.text));
    }
  };

  walkWidgets(detail, visit);
  for (const modalWidget of findModalWidgets(detail)) {
    if (modalWidget && typeof modalWidget === "object") {
      visit(modalWidget as Record<string, unknown>);
    }
  }

  const getSpec = (...keys: string[]) => {
    for (const key of keys) {
      const wanted = compactKey(key);
      for (const [currentKey, currentValue] of specs) {
        if (compactKey(currentKey).includes(wanted)) return currentValue;
      }
    }
    return null;
  };

  const transactionType: DivarTransaction = category.includes("rent") ? "rent" : "sell";
  const propertyType: DivarPropertyType = category.includes("villa") ? "villa" : "apartment";

  const areaM2 = parseNumber(getSpec("متراژ", "متراژ ملک", "متراژ زیربنا"));
  const bedrooms = parseNumber(getSpec("اتاق", "اتاق‌ها", "خواب"));
  const bathrooms = parseNumber(getSpec("تعداد سرویس بهداشتی", "سرویس بهداشتی", "حمام"));
  const floor = parseNumber(getSpec("طبقه"));
  const totalFloors = parseNumber(getSpec("تعداد کل طبقات ساختمان", "تعداد کل طبقات"));
  const builtYear = parseNumber(getSpec("ساخت", "سال ساخت"));

  let price = parseMoney(getSpec("قیمت کل", "قیمت ملک", "قیمت"));
  let deposit = parseMoney(getSpec("ودیعه", "رهن", "مبلغ رهن"));
  let rent = parseMoney(getSpec("اجاره ماهانه", "اجاره", "اجاره بها"));

  if (transactionType === "rent" && deposit == null && price != null) {
    deposit = price;
    price = null;
  }
  if (transactionType === "rent" && rent == null) {
    const rentSpec = getSpec("اجاره ماهانه", "اجاره");
    rent = parseMoney(rentSpec);
  }

  const featureBlob = featureTexts.map(normalizeDivarText).join(" ");
  const parking = /پارکینگ/u.test(featureBlob) && !/بدون پارکینگ|پارکینگ ندارد/u.test(featureBlob);
  const elevator = /آسانسور/u.test(featureBlob) && !/بدون آسانسور|آسانسور ندارد/u.test(featureBlob);
  const storage = /انباری/u.test(featureBlob) && !/بدون انباری|انباری ندارد/u.test(featureBlob);

  const images = Array.from(new Set(collectMediaUrls(detail)))
    .slice(0, MAX_IMAGES);

  const title = String(webInfo.title ?? "فایل دیوار").trim();
  const neighborhood = String(webInfo.district_persian ?? webInfo.district ?? "اصفهان").trim();
  const description = descriptions.map((v) => v.trim()).filter(Boolean).join("\n\n").slice(0, 5000);
  const safeDescription =
    description.length >= 10
      ? description
      : "توضیحات تکمیلی این فایل در آگهی دیوار موجود است.";

  return {
    token,
    title,
    transactionType,
    propertyType,
    neighborhood,
    areaM2,
    bedrooms,
    bathrooms,
    floor,
    totalFloors,
    builtYear,
    parking,
    elevator,
    storage,
    price: price != null ? String(price) : null,
    deposit: deposit != null ? String(deposit) : null,
    rent: rent != null ? String(rent) : null,
    description: safeDescription,
    features: Array.from(
      new Set(
        featureTexts
          .map((v) => v.trim())
          .filter((v) => v.length > 1)
          .slice(0, 20),
      ),
    ),
    images,
    sellerName:
      firstStringByKey(detail, /^(?:seller|owner|user|username|business_name|profile_name|author_name)$/i) ??
      firstStringByKey(webInfo, /seller|owner|user|business/i),
    sellerType: JSON.stringify(detail).includes("real-estate-business") ? "مشاور املاک" : "شخصی",
    sourceUrl: `${DIVAR_WEB}/v/${token}`,
  };
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "accept-language": "fa-IR,fa;q=0.9,en;q=0.7",
      "user-agent": "Mozilla/5.0",
      ...(init.headers ?? {}),
    },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Divar request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function resolveIsfahanCityId() {
  const data = await fetchJson<unknown>(`${DIVAR_API}/places/cities`);
  const cities = Array.isArray(data) ? data : (data && typeof data === "object" ? (data as Record<string, unknown>).cities : []);
  if (!Array.isArray(cities)) return "4";

  for (const city of cities) {
    if (!city || typeof city !== "object") continue;
    const c = city as Record<string, unknown>;
    if (String(c.slug ?? "").toLowerCase() === CITY_SLUG) return String(c.id);
    if (normalizeDivarText(c.name) === "اصفهان") return String(c.id);
  }
  return "4";
}

function extractListRows(data: unknown, category: (typeof CATEGORIES)[number]): ListingCandidate[] {
  const widgets =
    data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).list_widgets)
      ? (data as Record<string, unknown>).list_widgets
      : data && typeof data === "object" && (data as Record<string, unknown>).web_widgets
        ? ((data as Record<string, unknown>).web_widgets as Record<string, unknown>).post_list
        : [];

  if (!Array.isArray(widgets)) return [];
  const out: ListingCandidate[] = [];
  for (const widget of widgets) {
    if (!widget || typeof widget !== "object") continue;
    const w = widget as Record<string, unknown>;
    if (w.widget_type !== "POST_ROW") continue;

    const rawData = (w.data ?? {}) as Record<string, unknown>;
    const action = (rawData.action ?? {}) as Record<string, unknown>;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const token = String(payload.token ?? rawData.token ?? "").trim();
    if (!token) continue;
    const webInfo =
      (payload.web_info && typeof payload.web_info === "object"
        ? payload.web_info
        : rawData.web_info && typeof rawData.web_info === "object"
          ? rawData.web_info
          : {}) as Record<string, unknown>;

    out.push({
      token,
      category,
      webInfo,
    });
  }
  return out;
}

function listBody(cityId: string, category: string, paginationData?: unknown) {
  const formData: Record<string, unknown> = {
    category: { str: { value: category } },
    "business-type": { str: { value: "personal" } },
  };
  const body: Record<string, unknown> = {
    city_ids: [String(cityId)],
    search_data: { form_data: { data: formData } },
  };
  if (paginationData) body.pagination_data = paginationData;
  return body;
}

async function fetchCategoryPage(cityId: string, category: (typeof CATEGORIES)[number], cursor?: unknown) {
  try {
    return await fetchJson<unknown>(`${DIVAR_API}/postlist/w/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(listBody(cityId, category, cursor)),
    });
  } catch {
    // Divar occasionally changes a filter field's wire shape; retry the public search without the business filter.
    const body = listBody(cityId, category, cursor);
    const data = body.search_data as Record<string, unknown>;
    const form = (data.form_data as Record<string, unknown>).data as Record<string, unknown>;
    delete form["business-type"];
    return await fetchJson<unknown>(`${DIVAR_API}/postlist/w/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

function getPagination(data: unknown): { hasNext: boolean; cursor: unknown } {
  if (!data || typeof data !== "object") return { hasNext: false, cursor: undefined };
  const pagination = (data as Record<string, unknown>).pagination;
  if (!pagination || typeof pagination !== "object") return { hasNext: false, cursor: undefined };
  const p = pagination as Record<string, unknown>;
  return {
    hasNext: Boolean(p.has_next_page),
    cursor: p.data,
  };
}

function propertyTypeToSite(value: DivarPropertyType): "apartment" | "villa" {
  return value === "villa" ? "villa" : "apartment";
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "divar-property"
  );
}

async function uploadDivarImages(token: string, urls: string[]) {
  const imported: string[] = [];
  for (let index = 0; index < Math.min(urls.length, MAX_IMAGES); index += 1) {
    const source = urls[index];
    try {
      const response = await fetch(source, {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: DIVAR_WEB,
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) continue;

      const lengthHeader = Number(response.headers.get("content-length") ?? "0");
      if (lengthHeader > MAX_IMAGE_BYTES) continue;

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;

      const extension =
        contentType.includes("png") ? "png" :
        contentType.includes("webp") ? "webp" :
        contentType.includes("gif") ? "gif" : "jpg";

      const blob = await put(
        `properties/divar/${token}/${index + 1}-${crypto.randomUUID()}.${extension}`,
        bytes,
        {
          access: "public",
          contentType,
          addRandomSuffix: false,
        },
      );
      imported.push(blob.url);
    } catch (error) {
      console.warn("[divar] image import failed", source, error);
    }
  }
  return imported;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseJsonArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(row: Record<string, unknown>): DivarFile {
  return {
    id: String(row.id),
    token: String(row.token),
    title: String(row.title),
    transactionType: row.transaction_type as DivarTransaction,
    propertyType: row.property_type as DivarPropertyType,
    neighborhood: String(row.neighborhood ?? ""),
    areaM2: row.area_m2 == null ? null : Number(row.area_m2),
    bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    floor: row.floor == null ? null : Number(row.floor),
    totalFloors: row.total_floors == null ? null : Number(row.total_floors),
    builtYear: row.built_year == null ? null : Number(row.built_year),
    parking: Boolean(row.parking),
    elevator: Boolean(row.elevator),
    storage: Boolean(row.storage),
    price: row.price == null ? null : String(row.price),
    deposit: row.deposit == null ? null : String(row.deposit),
    rent: row.rent == null ? null : String(row.rent),
    description: String(row.description ?? ""),
    features: parseJsonArray(row.features),
    images: parseJsonArray(row.images),
    sellerName: row.seller_name == null ? null : String(row.seller_name),
    sellerType: row.seller_type == null ? null : String(row.seller_type),
    sourceUrl: String(row.source_url),
    filterStatus: row.filter_status as DivarFilterStatus,
    importedPropertyId: row.imported_property_id == null ? null : String(row.imported_property_id),
    importedAt: row.imported_at ? new Date(String(row.imported_at)).toISOString() : null,
    lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

const listSchema = z.object({
  status: z.enum(["accepted", "imported"]).optional().default("accepted"),
  limit: z.number().int().min(1).max(100).optional().default(60),
});

export const listDivarFiles = createServerFn({ method: "POST" })
  .validator(listSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") return [];
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select *
       from divar_files
       where filter_status = $1
       order by last_seen_at desc, created_at desc
       limit $2`,
      [data.status, data.limit],
    );
    return rows.map(mapRow);
  });

export const getDivarStats = createServerFn({ method: "POST" })
  .validator(adminInput)
  .handler(async () => {
    await requireAdmin();
    if (dbSource === "unconfigured") {
      return { accepted: 0, imported: 0, rejected: 0, totalSeen: 0, lastSyncAt: null } satisfies DivarStats;
    }
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(`
      select
        count(*) filter (where filter_status = 'accepted')::int as accepted,
        count(*) filter (where filter_status = 'imported')::int as imported,
        count(*) filter (where filter_status = 'rejected')::int as rejected,
        count(*)::int as total_seen,
        max(updated_at) as last_sync_at
      from divar_files
    `);
    const row = rows[0] ?? {};
    return {
      accepted: Number(row.accepted) || 0,
      imported: Number(row.imported) || 0,
      rejected: Number(row.rejected) || 0,
      totalSeen: Number(row.total_seen) || 0,
      lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)).toISOString() : null,
    } satisfies DivarStats;
  });

const syncSchema = z.object({
  limit: z.number().int().min(4).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
});

export const syncDivarFiles = createServerFn({ method: "POST" })
  .validator(syncSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") {
      throw new Error("DATABASE_URL تنظیم نشده است. اول PostgreSQL/Neon را به پروژه وصل کنید.");
    }

    const sql = await getSql();
    const cityId = await resolveIsfahanCityId();
    const target = data.limit;
    const seenTokens = new Set<string>();
    const acceptedRows: ParsedListing[] = [];
    let rejected = 0;
    let requests = 0;

    for (const category of CATEGORIES) {
      let cursor: unknown = undefined;
      let page = 0;
      while (acceptedRows.length < target && page < 3) {
        const dataPage = await fetchCategoryPage(cityId, category, cursor);
        requests += 1;
        const rows = extractListRows(dataPage, category);
        if (!rows.length) break;

        const candidates = rows.filter((row) => !seenTokens.has(row.token));
        for (const row of candidates) seenTokens.add(row.token);

        const preRejected = candidates.filter((row) => {
          const reason = getDivarAgencyReason(row.webInfo);
          return Boolean(reason);
        });

        for (const row of preRejected) {
          const reason = getDivarAgencyReason(row.webInfo) ?? "مشکوک به آگهی املاک";
          rejected += 1;
          await sql.query(
            `insert into divar_files (
              id, token, title, transaction_type, property_type, neighborhood,
              description, images, seller_name, seller_type, source_url,
              filter_status, reject_reason, last_seen_at, updated_at
            ) values (
              $1, $2, $3, $4, $5, $6,
              '', '[]'::jsonb, $7, 'business', $8,
              'rejected', $9, current_timestamp, current_timestamp
            )
            on conflict (token) do update set
              title = excluded.title,
              neighborhood = excluded.neighborhood,
              seller_name = excluded.seller_name,
              seller_type = 'business',
              filter_status = case when divar_files.filter_status = 'imported' then 'imported' else 'rejected' end,
              reject_reason = excluded.reject_reason,
              last_seen_at = current_timestamp,
              updated_at = current_timestamp`,
            [
              crypto.randomUUID(),
              row.token,
              String(row.webInfo.title ?? "فایل دیوار"),
              category.includes("rent") ? "rent" : "sell",
              category.includes("villa") ? "villa" : "apartment",
              String(row.webInfo.district_persian ?? row.webInfo.district ?? "اصفهان"),
              firstStringByKey(row.webInfo, /seller|owner|user|business/i),
              `${DIVAR_WEB}/v/${row.token}`,
              reason,
            ],
          );
        }

        const pending = candidates.filter((row) => !preRejected.some((r) => r.token === row.token));
        for (let offset = 0; offset < pending.length && acceptedRows.length < target; offset += DETAIL_BATCH) {
          const batch = pending.slice(offset, offset + DETAIL_BATCH);
          const results = await Promise.all(
            batch.map(async (row) => {
              try {
                const detail = await fetchJson<Record<string, unknown>>(
                  `${DIVAR_API}/posts-v2/web/${encodeURIComponent(row.token)}`,
                );
                const reason = getDivarAgencyReason(detail);
                if (reason) return { row, reason };
                return { row, parsed: parseDivarListing(detail, row.webInfo, row.category, row.token) };
              } catch (error) {
                console.warn("[divar] detail failed", row.token, error);
                return null;
              }
            }),
          );

          for (const result of results) {
            if (!result) continue;
            if ("reason" in result) {
              rejected += 1;
              await sql.query(
                `insert into divar_files (
                  id, token, title, transaction_type, property_type, neighborhood,
                  description, images, seller_name, seller_type, source_url,
                  filter_status, reject_reason, last_seen_at, updated_at
                ) values (
                  $1, $2, $3, $4, $5, $6,
                  '', '[]'::jsonb, $7, 'business', $8,
                  'rejected', $9, current_timestamp, current_timestamp
                )
                on conflict (token) do update set
                  title = excluded.title,
                  neighborhood = excluded.neighborhood,
                  seller_name = excluded.seller_name,
                  seller_type = 'business',
                  filter_status = case when divar_files.filter_status = 'imported' then 'imported' else 'rejected' end,
                  reject_reason = excluded.reject_reason,
                  last_seen_at = current_timestamp,
                  updated_at = current_timestamp`,
                [
                  crypto.randomUUID(),
                  result.row.token,
                  String(result.row.webInfo.title ?? "فایل دیوار"),
                  result.row.category.includes("rent") ? "rent" : "sell",
                  result.row.category.includes("villa") ? "villa" : "apartment",
                  String(result.row.webInfo.district_persian ?? result.row.webInfo.district ?? "اصفهان"),
                  firstStringByKey(result.row.webInfo, /seller|owner|user|business/i),
                  `${DIVAR_WEB}/v/${result.row.token}`,
                  result.reason,
                ],
              );
              continue;
            }

            acceptedRows.push(result.parsed);
            if (acceptedRows.length >= target) break;
          }
        }

        const pag = getPagination(dataPage);
        if (!pag.hasNext || !pag.cursor || pag.cursor === cursor) break;
        cursor = pag.cursor;
        page += 1;
      }
      if (acceptedRows.length >= target) break;
    }

    let accepted = 0;
    for (const item of acceptedRows) {
      const rows = await sql.query<Record<string, unknown>>(
        `select filter_status from divar_files where token = $1 limit 1`,
        [item.token],
      );
      const existing = rows[0]?.filter_status;
      await sql.query(
        `insert into divar_files (
          id, token, title, transaction_type, property_type, neighborhood,
          area_m2, bedrooms, bathrooms, floor, total_floors, built_year,
          parking, elevator, storage, price, deposit, rent, description,
          features, images, seller_name, seller_type, source_url,
          filter_status, last_seen_at, updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,$19,
          $20::jsonb,$21::jsonb,$22,$23,$24,
          $25,current_timestamp,current_timestamp
        )
        on conflict (token) do update set
          title = excluded.title,
          transaction_type = excluded.transaction_type,
          property_type = excluded.property_type,
          neighborhood = excluded.neighborhood,
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
          seller_name = excluded.seller_name,
          seller_type = excluded.seller_type,
          source_url = excluded.source_url,
          filter_status = case when divar_files.filter_status = 'imported' then 'imported' else 'accepted' end,
          reject_reason = null,
          last_seen_at = current_timestamp,
          updated_at = current_timestamp`,
        [
          crypto.randomUUID(),
          item.token,
          item.title,
          item.transactionType,
          item.propertyType,
          item.neighborhood,
          item.areaM2,
          item.bedrooms,
          item.bathrooms,
          item.floor,
          item.totalFloors,
          item.builtYear,
          item.parking,
          item.elevator,
          item.storage,
          item.price,
          item.deposit,
          item.rent,
          item.description,
          JSON.stringify(item.features),
          JSON.stringify(item.images),
          item.sellerName,
          item.sellerType,
          item.sourceUrl,
          existing === "imported" ? "imported" : "accepted",
        ],
      );
      accepted += existing === "imported" ? 0 : 1;
    }

    return {
      accepted: acceptedRows.length,
      visible: accepted,
      rejected,
      inspected: seenTokens.size,
      requests,
      syncedAt: new Date().toISOString(),
    };
  });

const idSchema = z.object({ id: z.string().min(1) });

export const importDivarFile = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (dbSource === "unconfigured") {
      throw new Error("DATABASE_URL تنظیم نشده است.");
    }

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select * from divar_files where id = $1 limit 1`,
      [data.id],
    );
    const row = rows[0];
    if (!row) throw new Error("فایل دیوار پیدا نشد.");

    const existingPropertyId = row.imported_property_id ? String(row.imported_property_id) : null;
    if (row.filter_status === "rejected") {
      throw new Error("این فایل به دلیل نشانه‌های مشاور/آژانس قابل ورود نیست.");
    }
    if (existingPropertyId) {
      return { propertyId: existingPropertyId, alreadyImported: true, imageCount: 0 };
    }

    const detailText = [
      row.title,
      row.description,
      row.seller_name,
      row.seller_type,
    ].join("\n");
    const reason = getDivarAgencyReason(detailText);
    if (reason) {
      await sql.query(
        `update divar_files set filter_status='rejected', reject_reason=$2, updated_at=current_timestamp where id=$1`,
        [data.id, reason],
      );
      throw new Error("این فایل دوباره توسط فیلتر مشاور/آژانس رد شد.");
    }

    const token = String(row.token);
    const originalImages = parseJsonArray(row.images);
    const images = originalImages.slice(0, MAX_IMAGES);
    const importedImages = await uploadDivarImages(token, images);

    const id = crypto.randomUUID();
    const propertyType = propertyTypeToSite(String(row.property_type) as DivarPropertyType);
    const title = String(row.title).trim() || "فایل دیوار";
    const slug = `${slugify(title)}-${id.slice(0, 8)}`;
    const transactionType = row.transaction_type === "rent" ? "rent" : "sell";
    const description = String(row.description ?? "").trim() || "فایل واردشده از دیوار.";

    await sql.query(
      `insert into properties (
        id, slug, status, featured, title, transaction_type, property_type, city,
        neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
        built_year, parking, elevator, storage, price, deposit, rent, description,
        features, images, contact_name, contact_phone, published_at
      ) values (
        $1,$2,'draft',false,$3,$4,$5,'اصفهان',
        $6,null,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,
        $20::jsonb,$21::jsonb,$22,$23,null
      )`,
      [
        id,
        slug,
        title,
        transactionType,
        propertyType,
        String(row.neighborhood ?? "اصفهان"),
        row.area_m2 == null ? null : Number(row.area_m2),
        row.bedrooms == null ? null : Number(row.bedrooms),
        row.bathrooms == null ? null : Number(row.bathrooms),
        row.floor == null ? null : Number(row.floor),
        row.total_floors == null ? null : Number(row.total_floors),
        row.built_year == null ? null : Number(row.built_year),
        Boolean(row.parking),
        Boolean(row.elevator),
        Boolean(row.storage),
        row.price == null ? null : String(row.price),
        row.deposit == null ? null : String(row.deposit),
        row.rent == null ? null : String(row.rent),
        description,
        JSON.stringify(parseJsonArray(row.features)),
        JSON.stringify(importedImages),
        TEAM[0]?.name ?? "مشاور هیرمند",
        TEAM[0]?.phone ?? SITE.phone.mobile,
      ],
    );

    await sql.query(
      `update divar_files
       set filter_status='imported',
           imported_property_id=$2,
           imported_at=current_timestamp,
           updated_at=current_timestamp
       where id=$1`,
      [data.id, id],
    );

    return {
      propertyId: id,
      alreadyImported: false,
      imageCount: importedImages.length,
    };
  });
