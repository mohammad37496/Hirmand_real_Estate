import { defineEventHandler, setResponseHeader } from "h3";
import { getCustomerIdentity } from "@/lib/customer-identity.server";
import { dbSource, getSql } from "@/lib/db";

function numberFrom(value: string | null) {
  if (!value) return null;
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  if (dbSource === "unconfigured") return { enabled: false, items: [], reason: "" };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const ownerId = userId ?? visitorId;
  const ownerColumn = userId ? "user_id" : "visitor_id";
  const sql = await getSql();
  const [favoriteRows, searchRows, watchRows, profileRows, candidateRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      "select p.transaction_type, p.property_type, p.neighborhood, p.area_m2, " +
      "case when p.transaction_type='rent' then coalesce(p.rent,p.deposit) when p.transaction_type='mortgage' then p.deposit else p.price end as price, " +
      "f.category, f.private_note, f.priority " +
      "from customer_favorites f join properties p on p.slug=f.property_slug and p.status='published' " +
      "where f." + ownerColumn + "=$1 order by f.priority desc, f.updated_at desc limit 12",
      [ownerId],
    ),
    sql.query<{ params: string }>(
      "select params from customer_saved_searches where " + ownerColumn + "=$1 and enabled=true order by updated_at desc limit 5",
      [ownerId],
    ),
    sql.query<Record<string, unknown>>(
      "select property_slug, target_price from property_watch_subscriptions where " + ownerColumn + "=$1 and enabled=true and target_price is not null limit 40",
      [ownerId],
    ),
    sql.query<Record<string, unknown>>(
      "select transaction_type, property_type, neighborhoods, min_price, max_price, min_area, max_area, bedrooms, requested_amenities, must_have_amenities from customer_need_profiles where visitor_id=$1 or ($2 is not null and user_id=$2) order by case when visitor_id=$1 then 0 else 1 end limit 1",
      [visitorId, userId],
    ),
    sql.query<Record<string, unknown>>(
      "select p.id::text as id, p.slug, p.title, p.transaction_type, p.property_type, p.neighborhood, p.area_m2, p.bedrooms, " +
      "case when p.transaction_type='rent' then coalesce(p.rent,p.deposit) when p.transaction_type='mortgage' then p.deposit else p.price end as price, " +
      "p.deposit, p.rent, nullif(p.images->>0,'') as image, p.featured, p.published_at, p.created_at " +
      "from properties p where p.status='published' order by " +
      "case when p.featured=true and (p.featured_until is null or p.featured_until>=current_timestamp) then 0 else 1 end, " +
      "p.published_at desc nulls last, p.created_at desc limit 160",
    ),
  ]);

  const favoriteSlugs = new Set(
    (await sql.query<{ property_slug: string }>(
      "select property_slug from customer_favorites where " + ownerColumn + "=$1 limit 100",
      [ownerId],
    )).map((row) => String(row.property_slug)),
  );

  const profileRow = profileRows[0] ?? null;
  const profile = profileRow ? {
    transactionType: String(profileRow.transaction_type ?? ""),
    propertyType: String(profileRow.property_type ?? ""),
    neighborhoods: Array.isArray(profileRow.neighborhoods) ? profileRow.neighborhoods.filter((x): x is string => typeof x === "string") : [],
    minPrice: profileRow.min_price == null ? null : Number(profileRow.min_price),
    maxPrice: profileRow.max_price == null ? null : Number(profileRow.max_price),
    minArea: profileRow.min_area == null ? null : Number(profileRow.min_area),
    maxArea: profileRow.max_area == null ? null : Number(profileRow.max_area),
    bedrooms: profileRow.bedrooms == null ? null : Number(profileRow.bedrooms),
    requestedAmenities: Array.isArray(profileRow.requested_amenities) ? profileRow.requested_amenities.filter((x): x is string => typeof x === "string") : [],
    mustHaveAmenities: Array.isArray(profileRow.must_have_amenities) ? profileRow.must_have_amenities.filter((x): x is string => typeof x === "string") : [],
  };

  const favorites = favoriteRows.map((row) => ({
    transactionType: String(row.transaction_type ?? ""),
    propertyType: String(row.property_type ?? ""),
    neighborhood: String(row.neighborhood ?? ""),
    price: row.price == null ? null : Number(row.price),
    areaM2: row.area_m2 == null ? null : Number(row.area_m2),
    category: String(row.category ?? "عمومی"),
    priority: Number(row.priority ?? 0),
    hasNote: Boolean(String(row.private_note ?? "").trim()),
  }));
  const targetPrices = watchRows
    .map((row) => row.target_price == null ? null : Number(row.target_price))
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  const searches = searchRows.map((row) => {
    const params = new URLSearchParams(String(row.params));
    return {
      transactionType: params.get("transaction") ?? "",
      propertyType: params.get("type") ?? "",
      neighborhood: params.get("neighborhood")?.trim() ?? "",
      minPrice: numberFrom(params.get("minPrice")),
      maxPrice: numberFrom(params.get("maxPrice")),
      minArea: numberFrom(params.get("minArea")),
      maxArea: numberFrom(params.get("maxArea")),
      bedrooms: numberFrom(params.get("bedrooms")),
    };
  });

  const txWeights = new Map<string, number>();
  const typeWeights = new Map<string, number>();
  const neighborhoodWeights = new Map<string, number>();
  for (const item of favorites) {
    const priorityBoost = Math.max(0, Math.min(3, item.priority));
    const categoryBoost = item.category === "مهم" ? 2 : item.category === "بررسی" ? 1 : 0;
    if (item.transactionType) txWeights.set(item.transactionType, (txWeights.get(item.transactionType) ?? 0) + 4 + priorityBoost);
    if (item.propertyType) typeWeights.set(item.propertyType, (typeWeights.get(item.propertyType) ?? 0) + 3 + priorityBoost);
    if (item.neighborhood) neighborhoodWeights.set(item.neighborhood, (neighborhoodWeights.get(item.neighborhood) ?? 0) + 2 + categoryBoost);
  }
  if (profile?.transactionType) txWeights.set(profile.transactionType, (txWeights.get(profile.transactionType) ?? 0) + 6);
  if (profile?.propertyType) typeWeights.set(profile.propertyType, (typeWeights.get(profile.propertyType) ?? 0) + 5);
  for (const neighborhood of profile?.neighborhoods ?? []) {
    neighborhoodWeights.set(neighborhood, (neighborhoodWeights.get(neighborhood) ?? 0) + 4);
  }

  for (const item of searches) {
    if (item.transactionType) txWeights.set(item.transactionType, (txWeights.get(item.transactionType) ?? 0) + 5);
    if (item.propertyType) typeWeights.set(item.propertyType, (typeWeights.get(item.propertyType) ?? 0) + 4);
    if (item.neighborhood) neighborhoodWeights.set(item.neighborhood, (neighborhoodWeights.get(item.neighborhood) ?? 0) + 3);
  }

  const pricedFavorites = favorites.filter((item) => item.price != null && Number.isFinite(item.price));
  const sizedFavorites = favorites.filter((item) => item.areaM2 != null && Number.isFinite(item.areaM2));
  const avgPrice = pricedFavorites.length ? pricedFavorites.reduce((sum, item) => sum + (item.price ?? 0), 0) / pricedFavorites.length : null;
  const avgArea = sizedFavorites.length ? sizedFavorites.reduce((sum, item) => sum + (item.areaM2 ?? 0), 0) / sizedFavorites.length : null;

  const scored = candidateRows.map((row) => {
    const item = {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      transactionType: String(row.transaction_type ?? ""),
      propertyType: String(row.property_type ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      areaM2: row.area_m2 == null ? null : Number(row.area_m2),
      bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
      price: row.price == null ? null : String(row.price),
      deposit: row.deposit == null ? null : String(row.deposit),
      rent: row.rent == null ? null : String(row.rent),
      image: row.image ? String(row.image) : null,
      status: "published" as const,
      availabilityStatus: String(row.availability_status ?? "available"),
      featured: Boolean(row.featured),
      publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    };

    if (favoriteSlugs.has(item.slug)) return { item, score: -1, maxScore: 100, reasons: [] as string[] };

    let score = 0;
    const maxScore = 100;
    const reasons: string[] = [];

    if (txWeights.has(item.transactionType)) {
      score += 20;
      reasons.push("نوع معامله مطابق انتخاب‌های شما");
    }
    if (typeWeights.has(item.propertyType)) {
      score += 20;
      reasons.push("نوع ملک مطابق سلیقه شما");
    }
    if (neighborhoodWeights.has(item.neighborhood)) {
      score += 15;
      reasons.push("محله مورد علاقه شما");
    }

    const candidatePrice = row.price == null ? null : Number(row.price);
    if (candidatePrice != null && avgPrice != null && avgPrice > 0) {
      const distance = Math.abs(candidatePrice - avgPrice) / avgPrice;
      if (distance <= 0.15) {
        score += 15;
        reasons.push("قیمت نزدیک به انتخاب‌های شما");
      } else if (distance <= 0.30) {
        score += 8;
      }
    }

    if (item.areaM2 != null && avgArea != null && avgArea > 0) {
      const distance = Math.abs(item.areaM2 - avgArea) / avgArea;
      if (distance <= 0.20) {
        score += 10;
        reasons.push("متراژ نزدیک به انتخاب‌های شما");
      } else if (distance <= 0.35) {
        score += 5;
      }
    }

    if (candidatePrice != null && targetPrices.length) {
      const closestTarget = targetPrices.reduce((best, target) =>
        Math.abs(target - candidatePrice) < Math.abs(best - candidatePrice) ? target : best,
      );
      const targetDistance = Math.abs(candidatePrice - closestTarget) / closestTarget;
      if (candidatePrice <= closestTarget) {
        score += 10;
        reasons.push("در محدوده قیمت هدف شما");
      } else if (targetDistance <= 0.12) {
        score += 5;
        reasons.push("نزدیک به قیمت هدف");
      }
    }

    if (profile) {
      let profileCompatible = true;
      if (profile.transactionType && profile.transactionType !== item.transactionType) profileCompatible = false;
      if (profile.propertyType && profile.propertyType !== item.propertyType) profileCompatible = false;
      if (profile.neighborhoods.length && !profile.neighborhoods.some((area) => item.neighborhood.includes(area))) profileCompatible = false;
      if (profile.minPrice != null && candidatePrice != null && candidatePrice < profile.minPrice) profileCompatible = false;
      if (profile.maxPrice != null && candidatePrice != null && candidatePrice > profile.maxPrice) profileCompatible = false;
      if (profile.minArea != null && item.areaM2 != null && item.areaM2 < profile.minArea) profileCompatible = false;
      if (profile.maxArea != null && item.areaM2 != null && item.areaM2 > profile.maxArea) profileCompatible = false;
      if (profile.bedrooms != null && item.bedrooms != null && item.bedrooms < profile.bedrooms) profileCompatible = false;
      if (profileCompatible) {
        score += 8;
        reasons.push("با پروفایل نیاز شما هم‌خوان است");
      } else {
        const hardMismatch =
          (profile.transactionType && profile.transactionType !== item.transactionType) ||
          (profile.propertyType && profile.propertyType !== item.propertyType);
        if (hardMismatch) return { item, score: -1, maxScore: 100, reasons: [] as string[] };
      }
    }

    for (const search of searches) {
      const outOfPrice =
        (search.minPrice != null && candidatePrice != null && candidatePrice < search.minPrice) ||
        (search.maxPrice != null && candidatePrice != null && candidatePrice > search.maxPrice);
      const outOfArea =
        (search.minArea != null && item.areaM2 != null && item.areaM2 < search.minArea) ||
        (search.maxArea != null && item.areaM2 != null && item.areaM2 > search.maxArea);
      const outOfBedrooms = search.bedrooms != null && item.bedrooms != null && item.bedrooms < search.bedrooms;
      if (outOfPrice || outOfArea || outOfBedrooms) continue;
      if (search.transactionType && search.transactionType !== item.transactionType) continue;
      if (search.propertyType && search.propertyType !== item.propertyType) continue;
      if (search.neighborhood && !item.neighborhood.includes(search.neighborhood)) continue;
      score += 10;
      reasons.push("منطبق با یکی از جست‌وجوهای شما");
      break;
    }

    if (item.featured && score > 0) score += 2;
    return { item, score: Math.min(maxScore, score), maxScore, reasons };
  });

  const items = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => ({
      ...entry.item,
      matchScore: Math.round((entry.score / entry.maxScore) * 100),
      reason: entry.reasons.slice(0, 2).join(" · ") || "بر اساس پروفایل و فعالیت شما",
    }));

  return {
    enabled: true,
    items,
    reason: favorites.length || searches.length || targetPrices.length || profile ? "personalized" : "empty",
  };
});
