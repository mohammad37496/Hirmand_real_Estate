import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bookmark,
  Heart,
  LayoutGrid,
  List,
  Map as MapIcon,
  MapPinned,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  countPublishedProperties,
  listPublishedPropertyCards,
  type PropertySort,
  type PropertyTransaction,
  type PropertyType,
} from "@/lib/properties";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PROPERTY_TYPES, NEIGHBORHOOD_NAMES, SERVICES } from "@/lib/site";
import {
  PROPERTY_CABINET_OPTIONS,
  PROPERTY_COOLING_OPTIONS,
  PROPERTY_FLOORING_OPTIONS,
  PROPERTY_HEATING_OPTIONS,
  PROPERTY_OTHER_AMENITY_OPTIONS,
  PROPERTY_WALL_CLOSET_OPTIONS,
} from "@/lib/property-options";
import { absoluteUrl, socialMeta } from "@/lib/seo";

const PAGE_SIZE = 48;
const SAVED_SEARCHES_KEY = "hirmand-saved-searches";
const MAX_SAVED_SEARCHES = 10;

const SORT_OPTIONS: { value: PropertySort; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "area_asc", label: "کمترین متراژ" },
  { value: "area_desc", label: "بیشترین متراژ" },
];

/** Listing types offered in the filters (the site type list plus land/commercial). */
const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  ...PROPERTY_TYPES.map((item) => ({ value: item.id as PropertyType, label: item.title })),
  { value: "land", label: "زمین" },
  { value: "commercial", label: "تجاری" },
];

const BEDROOM_OPTIONS = ["1", "2", "3", "4"] as const;

const SPEC_FILTER_OPTIONS = [
  ...PROPERTY_CABINET_OPTIONS.map((item) => ({ value: `cabinet:${item.value}`, label: item.label, group: "کابینت" })),
  ...PROPERTY_FLOORING_OPTIONS.map((item) => ({ value: `flooring:${item.value}`, label: item.label, group: "کف" })),
  ...PROPERTY_WALL_CLOSET_OPTIONS.map((item) => ({ value: `closet:${item.value}`, label: item.label, group: "کمد دیواری" })),
  ...PROPERTY_COOLING_OPTIONS.map((item) => ({ value: `cooling:${item.value}`, label: item.label, group: "سرمایش" })),
  ...PROPERTY_HEATING_OPTIONS.map((item) => ({ value: `heating:${item.value}`, label: item.label, group: "گرمایش" })),
  ...PROPERTY_OTHER_AMENITY_OPTIONS.map((item) => ({ value: item.value, label: item.label, group: "امکانات دیگر" })),
] as const;

const SPEC_GROUPS = ["کابینت", "کف", "کمد دیواری", "سرمایش", "گرمایش", "امکانات دیگر"] as const;

type SavedSearch = {
  id: string;
  name: string;
  params: string;
};

function readSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is SavedSearch =>
              Boolean(
                item &&
                  typeof item === "object" &&
                  typeof item.id === "string" &&
                  typeof item.name === "string" &&
                  typeof item.params === "string",
              ),
          )
          .slice(0, MAX_SAVED_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/properties")({
  loader: async () => {
    try {
      const [properties, total] = await Promise.all([
        listPublishedPropertyCards({ data: {} }),
        countPublishedProperties({ data: {} }),
      ]);
      return { properties, total };
    } catch (error) {
      console.error("[properties] loader failed", error);
      return { properties: [], total: 0 };
    }
  },
  head: () => {
    const title = "فایل‌های ملکی اصفهان | خرید، فروش، رهن و اجاره | هیرمند";
    const description = "فایل‌های منتشرشده خرید، فروش، رهن و اجاره ملک در اصفهان از گروه مشاورین املاک هیرمند.";
    const url = absoluteUrl("/properties");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: "فایل ملکی اصفهان, خرید آپارتمان اصفهان, فروش خانه اصفهان, رهن و اجاره اصفهان, املاک هیرمند" },
        { name: "robots", content: "index, follow, max-image-preview:large" },
        ...socialMeta({ title, description, url }),
      ],
      links: [
        { rel: "canonical", href: url },
        { rel: "alternate", hrefLang: "fa-IR", href: url },
      ],
    };
  },
  component: PropertiesIndexPage,
});

function toEnglishDigits(raw: string) {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function parseNumber(raw: string) {
  const cleaned = toEnglishDigits(raw).replace(/[^\d.-]/g, "");
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function validTransaction(value: string): PropertyTransaction | undefined {
  return value === "buy" || value === "sell" || value === "rent" || value === "mortgage" ? value : undefined;
}

function validPropertyType(value: string): PropertyType | undefined {
  return value === "apartment" || value === "villa" || value === "office" || value === "heritage" || value === "land" || value === "commercial"
    ? value
    : undefined;
}

function normalizeBounds(a: string, b: string) {
  const first = parseNumber(a);
  const second = parseNumber(b);
  if (first == null || second == null || first <= second) return [first, second] as const;
  return [second, first] as const;
}

function buildFilterData(
  q: string,
  transactionType: PropertyTransaction | "",
  propertyType: PropertyType | "",
  neighborhood: string,
  minArea: string,
  maxArea: string,
  minPrice: string,
  maxPrice: string,
  minBedrooms: string,
  minBathrooms: string,
  minFloor: string,
  maxFloor: string,
  minTotalFloors: string,
  maxTotalFloors: string,
  minBuiltYear: string,
  maxBuiltYear: string,
  parkingOnly: boolean,
  elevatorOnly: boolean,
  storageOnly: boolean,
  specFilters: string[],
  featureSearch: string,
  featuredOnly: boolean,
  hasImagesOnly: boolean,
  hasLocationOnly: boolean,
  sort: PropertySort,
  offset: number,
) {
  const [nextMinArea, nextMaxArea] = normalizeBounds(minArea, maxArea);
  const [nextMinPrice, nextMaxPrice] = normalizeBounds(minPrice, maxPrice);
  const [nextMinFloor, nextMaxFloor] = normalizeBounds(minFloor, maxFloor);
  const [nextMinTotalFloors, nextMaxTotalFloors] = normalizeBounds(minTotalFloors, maxTotalFloors);
  const [nextMinBuiltYear, nextMaxBuiltYear] = normalizeBounds(minBuiltYear, maxBuiltYear);
  return {
    search: q.trim() || undefined,
    transactionType: transactionType || undefined,
    propertyType: propertyType || undefined,
    neighborhood: neighborhood || undefined,
    minArea: nextMinArea,
    maxArea: nextMaxArea,
    minPrice: nextMinPrice,
    maxPrice: nextMaxPrice,
    minBedrooms: parseNumber(minBedrooms),
    minBathrooms: parseNumber(minBathrooms),
    minFloor: nextMinFloor,
    maxFloor: nextMaxFloor,
    minTotalFloors: nextMinTotalFloors,
    maxTotalFloors: nextMaxTotalFloors,
    minBuiltYear: nextMinBuiltYear,
    maxBuiltYear: nextMaxBuiltYear,
    parkingOnly,
    elevatorOnly,
    storageOnly,
    specFilters,
    featureSearch: featureSearch.trim() || undefined,
    featuredOnly,
    hasImagesOnly,
    hasLocationOnly,
    sort,
    offset,
  };
}

function FilterGroup({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="pf-group">
      <h3 className="pf-group-title">
        {title}
        {hint ? <small>{hint}</small> : null}
      </h3>
      <div className="pf-group-body">{children}</div>
    </section>
  );
}

function PropertiesIndexPage() {
  const initial = Route.useLoaderData();
  const [properties, setProperties] = useState(initial.properties);
  const [total, setTotal] = useState(initial.total);
  const [q, setQ] = useState("");
  const [transactionType, setTransactionType] = useState<PropertyTransaction | "">("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [neighborhood, setNeighborhood] = useState("");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [minBathrooms, setMinBathrooms] = useState("");
  const [minFloor, setMinFloor] = useState("");
  const [maxFloor, setMaxFloor] = useState("");
  const [minTotalFloors, setMinTotalFloors] = useState("");
  const [maxTotalFloors, setMaxTotalFloors] = useState("");
  const [minBuiltYear, setMinBuiltYear] = useState("");
  const [maxBuiltYear, setMaxBuiltYear] = useState("");
  const [parkingOnly, setParkingOnly] = useState(false);
  const [elevatorOnly, setElevatorOnly] = useState(false);
  const [storageOnly, setStorageOnly] = useState(false);
  const [specFilters, setSpecFilters] = useState<string[]>([]);
  const [specQuery, setSpecQuery] = useState("");
  const [featureSearch, setFeatureSearch] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [hasImagesOnly, setHasImagesOnly] = useState(false);
  const [hasLocationOnly, setHasLocationOnly] = useState(false);
  const [sort, setSort] = useState<PropertySort>("newest");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchId, setSavedSearchId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "split">("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const skipInitialFetch = useRef(false);
  const requestId = useRef(0);
  const queryCache = useRef(new Map<string, { rows: typeof initial.properties; count: number }>());
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSavedSearches(readSavedSearches());
    const params = new URLSearchParams(window.location.search);
    const tx = validTransaction(params.get("transaction") ?? "");
    const type = validPropertyType(params.get("type") ?? "");
    const sortParam = params.get("sort");
    const validSort: PropertySort =
      sortParam === "price_asc" ||
      sortParam === "price_desc" ||
      sortParam === "area_asc" ||
      sortParam === "area_desc"
        ? sortParam
        : "newest";

    setQ(params.get("q") ?? "");
    setTransactionType(tx ?? "");
    setPropertyType(type ?? "");
    setNeighborhood(params.get("neighborhood") ?? "");
    setMinArea(params.get("minArea") ?? "");
    setMaxArea(params.get("maxArea") ?? "");
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
    setMinBedrooms(params.get("bedrooms") ?? "");
    setMinBathrooms(params.get("bathrooms") ?? "");
    setMinFloor(params.get("minFloor") ?? "");
    setMaxFloor(params.get("maxFloor") ?? "");
    setMinTotalFloors(params.get("minFloors") ?? "");
    setMaxTotalFloors(params.get("maxFloors") ?? "");
    setMinBuiltYear(params.get("minYear") ?? "");
    setMaxBuiltYear(params.get("maxYear") ?? "");
    setParkingOnly(params.get("parking") === "1");
    setElevatorOnly(params.get("elevator") === "1");
    setStorageOnly(params.get("storage") === "1");
    setSpecFilters((params.get("specs") ?? "").split(",").map((item) => item.trim()).filter(Boolean));
    setFeatureSearch(params.get("features") ?? "");
    setFeaturedOnly(params.get("featured") === "1");
    setHasImagesOnly(params.get("images") === "1");
    setHasLocationOnly(params.get("location") === "1");
    setSort(validSort);
    skipInitialFetch.current = Array.from(params.keys()).length === 0;
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (transactionType) params.set("transaction", transactionType);
    if (propertyType) params.set("type", propertyType);
    if (neighborhood) params.set("neighborhood", neighborhood);
    if (minArea.trim()) params.set("minArea", minArea.trim());
    if (maxArea.trim()) params.set("maxArea", maxArea.trim());
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (minBedrooms.trim()) params.set("bedrooms", minBedrooms.trim());
    if (minBathrooms.trim()) params.set("bathrooms", minBathrooms.trim());
    if (minFloor.trim()) params.set("minFloor", minFloor.trim());
    if (maxFloor.trim()) params.set("maxFloor", maxFloor.trim());
    if (minTotalFloors.trim()) params.set("minFloors", minTotalFloors.trim());
    if (maxTotalFloors.trim()) params.set("maxFloors", maxTotalFloors.trim());
    if (minBuiltYear.trim()) params.set("minYear", minBuiltYear.trim());
    if (maxBuiltYear.trim()) params.set("maxYear", maxBuiltYear.trim());
    if (parkingOnly) params.set("parking", "1");
    if (elevatorOnly) params.set("elevator", "1");
    if (storageOnly) params.set("storage", "1");
    if (specFilters.length) params.set("specs", specFilters.join(","));
    if (featureSearch.trim()) params.set("features", featureSearch.trim());
    if (featuredOnly) params.set("featured", "1");
    if (hasImagesOnly) params.set("images", "1");
    if (hasLocationOnly) params.set("location", "1");
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/properties?${query}` : "/properties");
  }, [urlReady, q, transactionType, propertyType, neighborhood, minArea, maxArea, minPrice, maxPrice, minBedrooms, parkingOnly, elevatorOnly, storageOnly, specFilters, sort]);

  useEffect(() => {
    if (!urlReady || skipInitialFetch.current) {
      if (urlReady) skipInitialFetch.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setOffset(0);

      const data = buildFilterData(
        q,
        transactionType,
        propertyType,
        neighborhood,
        minArea,
        maxArea,
        minPrice,
        maxPrice,
        minBedrooms,
        minBathrooms,
        minFloor,
        maxFloor,
        minTotalFloors,
        maxTotalFloors,
        minBuiltYear,
        maxBuiltYear,
        parkingOnly,
        elevatorOnly,
        storageOnly,
        specFilters,
        sort,
        0,
      );
      const cacheKey = new URLSearchParams(
        Object.entries(data)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      ).toString();

      const cached = queryCache.current.get(cacheKey);
      if (cached) {
        setProperties(cached.rows);
        setTotal(cached.count);
        setLoading(false);
        return;
      }

      try {
        const [rows, count] = await Promise.all([
          listPublishedPropertyCards({ data }),
          countPublishedProperties({ data }),
        ]);
        if (requestId.current !== currentRequest) return;
        const result = { rows, count };
        queryCache.current.set(cacheKey, result);
        if (queryCache.current.size > 24) {
          const firstKey = queryCache.current.keys().next().value;
          if (firstKey) queryCache.current.delete(firstKey);
        }
        setProperties(rows);
        setTotal(count);
      } catch {
        toast.error("جستجوی فایل‌ها انجام نشد. اتصال اینترنت یا سرویس فایل‌ها را بررسی کنید.");
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [urlReady, q, transactionType, propertyType, neighborhood, minArea, maxArea, minPrice, maxPrice, minBedrooms, minBathrooms, minFloor, maxFloor, minTotalFloors, maxTotalFloors, minBuiltYear, maxBuiltYear, parkingOnly, elevatorOnly, storageOnly, specFilters, featureSearch, featuredOnly, hasImagesOnly, hasLocationOnly, sort]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || properties.length >= total) return;
    const nextOffset = offset + PAGE_SIZE;
    const queryVersion = requestId.current;
    setLoadingMore(true);
    try {
      const rows = await listPublishedPropertyCards({
        data: buildFilterData(
          q,
          transactionType,
          propertyType,
          neighborhood,
          minArea,
          maxArea,
          minPrice,
          maxPrice,
          minBedrooms,
          minBathrooms,
          minFloor,
          maxFloor,
          minTotalFloors,
          maxTotalFloors,
          minBuiltYear,
          maxBuiltYear,
          parkingOnly,
          elevatorOnly,
          storageOnly,
          specFilters,
          featureSearch,
          featuredOnly,
          hasImagesOnly,
          hasLocationOnly,
          sort,
          nextOffset,
        ),
      });

      // A filter change can finish while this older page is still in flight.
      // Never append stale rows to the new result set.
      if (requestId.current !== queryVersion) return;

      if (!rows.length) {
        // Prevent the intersection sentinel from hammering the same empty page.
        setOffset(nextOffset);
        setTotal((currentTotal) => Math.min(currentTotal, nextOffset));
        return;
      }

      setProperties((current) => [...current, ...rows]);
      setOffset(nextOffset);
    } catch {
      // Keep current page visible.
    } finally {
      setLoadingMore(false);
    }
  }, [
    loading,
    loadingMore,
    properties.length,
    total,
    offset,
    q,
    transactionType,
    propertyType,
    neighborhood,
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    minBedrooms,
    minBathrooms,
    minFloor,
    maxFloor,
    minTotalFloors,
    maxTotalFloors,
    minBuiltYear,
    maxBuiltYear,
    parkingOnly,
    elevatorOnly,
    storageOnly,
    specFilters,
    featureSearch,
    featuredOnly,
    hasImagesOnly,
    hasLocationOnly,
    sort,
  ]);

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "420px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  function currentFilterParams() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (transactionType) params.set("transaction", transactionType);
    if (propertyType) params.set("type", propertyType);
    if (neighborhood) params.set("neighborhood", neighborhood);
    if (minArea.trim()) params.set("minArea", minArea.trim());
    if (maxArea.trim()) params.set("maxArea", maxArea.trim());
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (minBedrooms.trim()) params.set("bedrooms", minBedrooms.trim());
    if (minBathrooms.trim()) params.set("bathrooms", minBathrooms.trim());
    if (minFloor.trim()) params.set("minFloor", minFloor.trim());
    if (maxFloor.trim()) params.set("maxFloor", maxFloor.trim());
    if (minTotalFloors.trim()) params.set("minFloors", minTotalFloors.trim());
    if (maxTotalFloors.trim()) params.set("maxFloors", maxTotalFloors.trim());
    if (minBuiltYear.trim()) params.set("minYear", minBuiltYear.trim());
    if (maxBuiltYear.trim()) params.set("maxYear", maxBuiltYear.trim());
    if (parkingOnly) params.set("parking", "1");
    if (elevatorOnly) params.set("elevator", "1");
    if (storageOnly) params.set("storage", "1");
    if (specFilters.length) params.set("specs", specFilters.join(","));
    if (featureSearch.trim()) params.set("features", featureSearch.trim());
    if (featuredOnly) params.set("featured", "1");
    if (hasImagesOnly) params.set("images", "1");
    if (hasLocationOnly) params.set("location", "1");
    if (sort !== "newest") params.set("sort", sort);
    return params;
  }

  function saveCurrentSearch() {
    const params = currentFilterParams();
    if (!params.toString()) {
      toast.info("اول چند فیلتر یا یک عبارت جست‌وجو انتخاب کنید.");
      return;
    }

    const defaultName = q.trim() || (transactionType ? SERVICES.find((item) => item.id === transactionType)?.title : "") || "جست‌وجوی من";
    const name = window.prompt("نام این جست‌وجو را وارد کنید:", defaultName)?.trim();
    if (!name) return;

    const entry: SavedSearch = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      name: name.slice(0, 60),
      params: params.toString(),
    };
    const next = [entry, ...savedSearches.filter((item) => item.params !== entry.params)].slice(0, MAX_SAVED_SEARCHES);

    try {
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
      setSavedSearches(next);
      setSavedSearchId(entry.id);
      toast.success("جست‌وجو ذخیره شد.");
    } catch {
      toast.error("ذخیره جست‌وجو در این مرورگر ممکن نشد.");
    }
  }

  function loadSavedSearch(id: string) {
    setSavedSearchId(id);
    const saved = savedSearches.find((item) => item.id === id);
    if (!saved) return;

    const params = new URLSearchParams(saved.params);
    setQ(params.get("q") ?? "");
    setTransactionType(validTransaction(params.get("transaction") ?? "") ?? "");
    setPropertyType(validPropertyType(params.get("type") ?? "") ?? "");
    setNeighborhood(params.get("neighborhood") ?? "");
    setMinArea(params.get("minArea") ?? "");
    setMaxArea(params.get("maxArea") ?? "");
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
    setMinBedrooms(params.get("bedrooms") ?? "");
    setMinBathrooms(params.get("bathrooms") ?? "");
    setMinFloor(params.get("minFloor") ?? "");
    setMaxFloor(params.get("maxFloor") ?? "");
    setMinTotalFloors(params.get("minFloors") ?? "");
    setMaxTotalFloors(params.get("maxFloors") ?? "");
    setMinBuiltYear(params.get("minYear") ?? "");
    setMaxBuiltYear(params.get("maxYear") ?? "");
    setParkingOnly(params.get("parking") === "1");
    setElevatorOnly(params.get("elevator") === "1");
    setStorageOnly(params.get("storage") === "1");
    setSpecFilters((params.get("specs") ?? "").split(",").map((item) => item.trim()).filter(Boolean));
    setFeatureSearch(params.get("features") ?? "");
    setFeaturedOnly(params.get("featured") === "1");
    setHasImagesOnly(params.get("images") === "1");
    setHasLocationOnly(params.get("location") === "1");
    const savedSort = params.get("sort");
    setSort(
      savedSort === "price_asc" ||
        savedSort === "price_desc" ||
        savedSort === "area_asc" ||
        savedSort === "area_desc"
        ? savedSort
        : "newest",
    );
    toast.success("جست‌وجوی ذخیره‌شده اعمال شد.");
  }

  function deleteSavedSearch() {
    if (!savedSearchId) return;
    const next = savedSearches.filter((item) => item.id !== savedSearchId);
    try {
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
      setSavedSearches(next);
      setSavedSearchId("");
      toast.success("جست‌وجوی ذخیره‌شده حذف شد.");
    } catch {
      toast.error("حذف جست‌وجو انجام نشد.");
    }
  }

  function resetFilters() {
    setQ("");
    setTransactionType("");
    setPropertyType("");
    setNeighborhood("");
    setMinArea("");
    setMaxArea("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setMinBathrooms("");
    setMinFloor("");
    setMaxFloor("");
    setMinTotalFloors("");
    setMaxTotalFloors("");
    setMinBuiltYear("");
    setMaxBuiltYear("");
    setParkingOnly(false);
    setElevatorOnly(false);
    setStorageOnly(false);
    setSpecFilters([]);
    setSpecQuery("");
    setFeatureSearch("");
    setFeaturedOnly(false);
    setHasImagesOnly(false);
    setHasLocationOnly(false);
    setSort("newest");
    setOffset(0);
  }

  async function shareCurrentSearch() {
    const params = currentFilterParams();
    const url = new URL("/properties", window.location.origin);
    url.search = params.toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "جست‌وجوی فایل‌های هیرمند",
          text: "این جست‌وجوی فایل در هیرمند را ببینید.",
          url: url.toString(),
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
        toast.success("لینک جست‌وجو کپی شد.");
      } else {
        window.prompt("لینک جست‌وجو:", url.toString());
        return;
      }
      trackAnalyticsEvent("search_share");
    } catch {
      // User cancelled the native share sheet.
    }
  }

  useEffect(() => {
    if (viewMode !== "split") return;
    const current = properties.find((property) => property.id === selectedPropertyId);
    if (!current || current.latitude == null || current.longitude == null) {
      const firstWithLocation = properties.find((property) => property.latitude != null && property.longitude != null);
      setSelectedPropertyId(firstWithLocation?.id ?? null);
    }
  }, [viewMode, properties, selectedPropertyId]);

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? null;
  const mapUrl = selectedProperty?.latitude != null && selectedProperty?.longitude != null
    ? `https://www.google.com/maps?q=${selectedProperty.latitude},${selectedProperty.longitude}&z=15&output=embed`
    : null;

  const hasFilters = Boolean(
    q.trim() ||
    transactionType ||
    propertyType ||
    neighborhood ||
    minArea.trim() ||
    maxArea.trim() ||
    minPrice.trim() ||
    maxPrice.trim() ||
    minBedrooms.trim() ||
    minBathrooms.trim() ||
    minFloor.trim() ||
    maxFloor.trim() ||
    minTotalFloors.trim() ||
    maxTotalFloors.trim() ||
    minBuiltYear.trim() ||
    maxBuiltYear.trim() ||
    parkingOnly ||
    elevatorOnly ||
    storageOnly ||
    specFilters.length > 0 ||
    featureSearch.trim() ||
    featuredOnly ||
    hasImagesOnly ||
    hasLocationOnly ||
    sort !== "newest",
  );

  const activeFilterCount = [
    q.trim(),
    transactionType,
    propertyType,
    neighborhood,
    minArea.trim() || maxArea.trim(),
    minPrice.trim() || maxPrice.trim(),
    minBedrooms.trim(),
    minBathrooms.trim() || minFloor.trim() || maxFloor.trim() || minTotalFloors.trim() || maxTotalFloors.trim() || minBuiltYear.trim() || maxBuiltYear.trim(),
    parkingOnly ? "parking" : "",
    elevatorOnly ? "elevator" : "",
    storageOnly ? "storage" : "",
    specFilters.length ? "specs" : "",
    featureSearch.trim(),
    featuredOnly ? "featured" : "",
    hasImagesOnly ? "images" : "",
    hasLocationOnly ? "location" : "",
  ].filter(Boolean).length;

  const transactionLabel = transactionType
    ? SERVICES.find((item) => item.id === transactionType)?.title ?? transactionType
    : "";
  const propertyTypeLabel = propertyType
    ? PROPERTY_TYPE_OPTIONS.find((item) => item.value === propertyType)?.label ?? propertyType
    : "";

  const filterChips = [
    q.trim() ? { label: `جستجو: ${q.trim()}`, clear: () => setQ("") } : null,
    transactionType ? { label: transactionLabel, clear: () => setTransactionType("") } : null,
    propertyType ? { label: propertyTypeLabel, clear: () => setPropertyType("") } : null,
    neighborhood ? { label: neighborhood, clear: () => setNeighborhood("") } : null,
    minArea.trim() || maxArea.trim()
      ? { label: `متراژ ${minArea || "۰"} تا ${maxArea || "∞"} متر`, clear: () => { setMinArea(""); setMaxArea(""); } }
      : null,
    minPrice.trim() || maxPrice.trim()
      ? { label: `قیمت ${minPrice || "۰"} تا ${maxPrice || "∞"}`, clear: () => { setMinPrice(""); setMaxPrice(""); } }
      : null,
    minBedrooms.trim() ? { label: `${minBedrooms} خواب به بالا`, clear: () => setMinBedrooms("") } : null,
    minBathrooms.trim() ? { label: `${minBathrooms} حمام به بالا`, clear: () => setMinBathrooms("") } : null,
    minFloor.trim() || maxFloor.trim()
      ? { label: `طبقه ${minFloor || "همه"} تا ${maxFloor || "همه"}`, clear: () => { setMinFloor(""); setMaxFloor(""); } }
      : null,
    minTotalFloors.trim() || maxTotalFloors.trim()
      ? { label: `تعداد طبقات ${minTotalFloors || "همه"} تا ${maxTotalFloors || "همه"}`, clear: () => { setMinTotalFloors(""); setMaxTotalFloors(""); } }
      : null,
    minBuiltYear.trim() || maxBuiltYear.trim()
      ? { label: `ساخت ${minBuiltYear || "همه"} تا ${maxBuiltYear || "همه"}`, clear: () => { setMinBuiltYear(""); setMaxBuiltYear(""); } }
      : null,
    parkingOnly ? { label: "پارکینگ", clear: () => setParkingOnly(false) } : null,
    elevatorOnly ? { label: "آسانسور", clear: () => setElevatorOnly(false) } : null,
    storageOnly ? { label: "انباری", clear: () => setStorageOnly(false) } : null,
    specFilters.length
      ? { label: `جزئیات ملک: ${specFilters.length.toLocaleString("fa-IR")}`, clear: () => setSpecFilters([]) }
      : null,
    featureSearch.trim() ? { label: `ویژگی: ${featureSearch.trim()}`, clear: () => setFeatureSearch("") } : null,
    featuredOnly ? { label: "فایل ویژه", clear: () => setFeaturedOnly(false) } : null,
    hasImagesOnly ? { label: "دارای عکس", clear: () => setHasImagesOnly(false) } : null,
    hasLocationOnly ? { label: "دارای موقعیت", clear: () => setHasLocationOnly(false) } : null,
  ].filter((item): item is { label: string; clear: () => void } => Boolean(item));

  function toggleSpecFilter(value: string) {
    setSpecFilters((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  const fa = (value: number) => value.toLocaleString("fa-IR");

  return (
    <SiteChrome>
      <main className="page-shell pf-page">
        <header className="pf-hero">
          <span className="pf-kicker">فایل‌های هیرمند</span>
          <div className="pf-hero-row">
            <div className="pf-hero-copy">
              <h1>فایل‌های ملکی اصفهان</h1>
              <p>
                بر اساس معامله، نوع ملک، محله، متراژ و بازه قیمت جست‌وجو کنید. فایل مناسب را باز کنید و
                مستقیم با مشاور همان فایل تماس بگیرید.
              </p>
            </div>
            <dl className="pf-stats">
              <div>
                <dt>فایل فعال</dt>
                <dd>{fa(total)}</dd>
              </div>
              <div>
                <dt>محله اصفهان</dt>
                <dd>{fa(NEIGHBORHOOD_NAMES.length)}+</dd>
              </div>
              <div>
                <dt>نوع معامله</dt>
                <dd>{fa(SERVICES.length)}</dd>
              </div>
            </dl>
          </div>

          <div className="pf-toolbar">
            <label className="pf-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="دنبال چه ملکی هستید؟ محله، عنوان یا آدرس"
                aria-label="جست‌وجوی فایل"
              />
              {q ? (
                <button type="button" aria-label="پاک کردن جست‌وجو" onClick={() => setQ("")}>
                  <X size={15} />
                </button>
              ) : null}
            </label>
            <button
              type="button"
              className="pf-filter-btn"
              onClick={() => setMobileFiltersOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={mobileFiltersOpen}
            >
              <SlidersHorizontal size={17} />
              فیلترها
              {activeFilterCount ? <span>{fa(activeFilterCount)}</span> : null}
            </button>
          </div>
        </header>

        {mobileFiltersOpen ? (
          <button
            type="button"
            className="pf-backdrop"
            aria-label="بستن فیلترها"
            onClick={() => setMobileFiltersOpen(false)}
          />
        ) : null}

        <div className="pf-layout">
          <aside
            className={`pf-sidebar${mobileFiltersOpen ? " is-open" : ""}`}
            role={mobileFiltersOpen ? "dialog" : undefined}
            aria-modal={mobileFiltersOpen ? true : undefined}
            aria-label={mobileFiltersOpen ? "فیلترهای فایل" : "فیلترهای فایل"}
          >
            <div className="pf-sidebar-head">
              <div>
                <strong>فیلتر و مرتب‌سازی</strong>
                <small>نتایج هم‌زمان با انتخاب شما به‌روز می‌شوند.</small>
              </div>
              <button type="button" className="pf-close" aria-label="بستن فیلترها" onClick={() => setMobileFiltersOpen(false)}>
                <X size={19} />
              </button>
            </div>

            <FilterGroup title="نوع معامله">
              <div className="pf-chips">
                <button
                  type="button"
                  className={`pf-chip${transactionType ? "" : " is-active"}`}
                  onClick={() => setTransactionType("")}
                >
                  همه
                </button>
                {SERVICES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`pf-chip${transactionType === item.id ? " is-active" : ""}`}
                    onClick={() => setTransactionType(transactionType === item.id ? "" : (item.id as PropertyTransaction))}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="نوع ملک">
              <div className="pf-chips">
                <button
                  type="button"
                  className={`pf-chip${propertyType ? "" : " is-active"}`}
                  onClick={() => setPropertyType("")}
                >
                  همه
                </button>
                {PROPERTY_TYPE_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`pf-chip${propertyType === item.value ? " is-active" : ""}`}
                    onClick={() => setPropertyType(propertyType === item.value ? "" : item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="محله" hint={`${fa(NEIGHBORHOOD_NAMES.length)} محله`}>
              <label className="pf-field">
                <span className="sr-only">انتخاب محله</span>
                <select className="pf-select" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
                  <option value="">همه محله‌ها</option>
                  {NEIGHBORHOOD_NAMES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </FilterGroup>

            <FilterGroup title="متراژ" hint="متر مربع">
              <div className="pf-range">
                <label className="pf-field">
                  <span>از</span>
                  <input inputMode="numeric" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="۸۰" />
                </label>
                <i aria-hidden="true">—</i>
                <label className="pf-field">
                  <span>تا</span>
                  <input inputMode="numeric" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="۲۵۰" />
                </label>
              </div>
            </FilterGroup>

            <FilterGroup title="بازه قیمت" hint="تومان">
              <div className="pf-range">
                <label className="pf-field">
                  <span>از</span>
                  <input inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="۰" />
                </label>
                <i aria-hidden="true">—</i>
                <label className="pf-field">
                  <span>تا</span>
                  <input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="نامحدود" />
                </label>
              </div>
            </FilterGroup>

            <FilterGroup title="اتاق‌ها و ساختمان" hint="فیلترهای دقیق‌تر">
              <div className="pf-range">
                <label className="pf-field">
                  <span>حداقل خواب</span>
                  <input inputMode="numeric" value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} placeholder="۲" />
                </label>
                <label className="pf-field">
                  <span>حداقل حمام</span>
                  <input inputMode="numeric" value={minBathrooms} onChange={(e) => setMinBathrooms(e.target.value)} placeholder="۱" />
                </label>
              </div>
              <div className="pf-range">
                <label className="pf-field"><span>از طبقه</span><input inputMode="numeric" value={minFloor} onChange={(e) => setMinFloor(e.target.value)} placeholder="همکف" /></label>
                <i aria-hidden="true">—</i>
                <label className="pf-field"><span>تا طبقه</span><input inputMode="numeric" value={maxFloor} onChange={(e) => setMaxFloor(e.target.value)} placeholder="۲۰" /></label>
              </div>
              <div className="pf-range">
                <label className="pf-field"><span>از تعداد طبقات</span><input inputMode="numeric" value={minTotalFloors} onChange={(e) => setMinTotalFloors(e.target.value)} placeholder="۱" /></label>
                <i aria-hidden="true">—</i>
                <label className="pf-field"><span>تا تعداد طبقات</span><input inputMode="numeric" value={maxTotalFloors} onChange={(e) => setMaxTotalFloors(e.target.value)} placeholder="۱۰" /></label>
              </div>
              <div className="pf-range">
                <label className="pf-field"><span>سال ساخت از</span><input inputMode="numeric" value={minBuiltYear} onChange={(e) => setMinBuiltYear(e.target.value)} placeholder="۱۳۹۵" /></label>
                <i aria-hidden="true">—</i>
                <label className="pf-field"><span>سال ساخت تا</span><input inputMode="numeric" value={maxBuiltYear} onChange={(e) => setMaxBuiltYear(e.target.value)} placeholder="۱۴۰۵" /></label>
              </div>
            </FilterGroup>

            <FilterGroup title="ویژگی‌های فایل" hint="امکانات سفارشی ثبت‌شده توسط ادمین">
              <label className="pf-field">
                <span>جست‌وجو در ویژگی‌های تکمیلی</span>
                <input value={featureSearch} onChange={(e) => setFeatureSearch(e.target.value)} placeholder="مثلاً نورگیر، بازسازی‌شده، خوش‌نقشه" />
              </label>
            </FilterGroup>

            <FilterGroup title="وضعیت و امکانات پایه">
              <label className="pf-switch"><span>فقط فایل ویژه</span><input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} /></label>
              <label className="pf-switch"><span>فقط دارای عکس</span><input type="checkbox" checked={hasImagesOnly} onChange={(e) => setHasImagesOnly(e.target.checked)} /></label>
              <label className="pf-switch"><span>فقط دارای موقعیت روی نقشه</span><input type="checkbox" checked={hasLocationOnly} onChange={(e) => setHasLocationOnly(e.target.checked)} /></label>
              <label className="pf-switch"><span>فقط پارکینگ‌دار</span><input type="checkbox" checked={parkingOnly} onChange={(e) => setParkingOnly(e.target.checked)} /></label>
              <label className="pf-switch"><span>فقط آسانسوردار</span><input type="checkbox" checked={elevatorOnly} onChange={(e) => setElevatorOnly(e.target.checked)} /></label>
              <label className="pf-switch"><span>فقط انباری‌دار</span><input type="checkbox" checked={storageOnly} onChange={(e) => setStorageOnly(e.target.checked)} /></label>
            </FilterGroup>

            <section className={`pf-spec-filter${specFilters.length ? " has-selection" : ""}`} aria-labelledby="pf-spec-title">
              <div className="pf-spec-filter-head">
                <div>
                  <strong id="pf-spec-title">همه امکانات و مشخصات فایل</strong>
                  <small>۹۴ گزینه جزئی در ۶ گروه؛ همه گزینه‌ها همیشه قابل مشاهده و انتخاب هستند.</small>
                </div>
                <span>{specFilters.length ? `${fa(specFilters.length)} انتخاب` : "بدون انتخاب"}</span>
              </div>
              <div className="pf-spec-toolbar">
                <label className="pf-spec-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={specQuery}
                    onChange={(event) => setSpecQuery(event.target.value)}
                    placeholder="جست‌وجو در امکانات؛ مثلاً تراس، استخر، MDF..."
                    aria-label="جست‌وجو در امکانات و مشخصات"
                  />
                  {specQuery ? <button type="button" aria-label="پاک کردن جست‌وجوی امکانات" onClick={() => setSpecQuery("")}><X size={13} /></button> : null}
                </label>
                {specFilters.length ? <button type="button" className="pf-spec-clear" onClick={() => setSpecFilters([])}>پاک‌کردن انتخاب‌ها</button> : null}
              </div>
              <div className="pf-spec-groups">
                {SPEC_GROUPS.map((group) => {
                  const allOptions = SPEC_FILTER_OPTIONS.filter((item) => item.group === group);
                  const query = specQuery.trim().toLocaleLowerCase();
                  const options = query ? allOptions.filter((item) => item.label.toLocaleLowerCase().includes(query)) : allOptions;
                  const selectedCount = allOptions.filter((item) => specFilters.includes(item.value)).length;
                  return (
                    <section className="pf-spec-filter-group" key={group}>
                      <div className="pf-spec-filter-group-title">
                        <span>{group}</span>
                        <small>{selectedCount ? `${fa(selectedCount)} انتخاب` : `${fa(allOptions.length)} گزینه`}</small>
                      </div>
                      {options.length ? (
                        <div className="pf-spec-options">
                          {options.map((item) => {
                            const active = specFilters.includes(item.value);
                            return (
                              <button key={item.value} type="button" className={`pf-spec-option${active ? " is-active" : ""}`} onClick={() => toggleSpecFilter(item.value)} aria-pressed={active}>
                                <span className="pf-spec-option-mark" aria-hidden="true">{active ? "✓" : ""}</span>
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : <p className="pf-spec-empty">موردی با این عبارت پیدا نشد.</p>}
                    </section>
                  );
                })}
              </div>
            </section>

            <div className="pf-sidebar-foot">
              <button type="button" className="pf-reset" onClick={resetFilters}>
                <RotateCcw size={15} /> پاک‌کردن فیلترها
              </button>
            </div>
          </aside>

          <div className="pf-main">
            <div className="pf-quick" aria-label="دسترسی سریع">
              <span>دسترسی سریع</span>
              {SERVICES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pf-chip${transactionType === item.id ? " is-active" : ""}`}
                  onClick={() => setTransactionType(transactionType === item.id ? "" : (item.id as PropertyTransaction))}
                >
                  {item.title}
                </button>
              ))}
              {PROPERTY_TYPE_OPTIONS.slice(0, 4).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`pf-chip${propertyType === item.value ? " is-active" : ""}`}
                  onClick={() => setPropertyType(propertyType === item.value ? "" : item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filterChips.length ? (
              <div className="pf-active" aria-label="فیلترهای فعال">
                <span className="pf-active-label">فیلترهای فعال</span>
                {filterChips.map((item) => (
                  <button key={item.label} type="button" className="pf-chip" onClick={item.clear}>
                    {item.label}
                    <X size={12} />
                  </button>
                ))}
                <button type="button" className="pf-chip" onClick={resetFilters}>
                  پاک کردن همه
                </button>
              </div>
            ) : null}

            <div className="pf-results-head">
              <div className="pf-count">
                <strong>{fa(properties.length)}</strong>
                <span>از {fa(total)} فایل</span>
                {loading ? <em>در حال جست‌وجو…</em> : null}
              </div>
              <div className="pf-head-actions">
                <label className="pf-sort">
                  <span>مرتب‌سازی</span>
                  <select
                    className="pf-select"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as PropertySort)}
                    aria-label="مرتب‌سازی نتایج"
                  >
                    {SORT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <div className="pf-views" role="group" aria-label="نحوه نمایش فایل‌ها">
                  <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")}>
                    <List size={15} /> <span>لیستی</span>
                  </button>
                  <button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")}>
                    <LayoutGrid size={15} /> <span>شبکه‌ای</span>
                  </button>
                  <button type="button" className={viewMode === "split" ? "is-active" : ""} onClick={() => setViewMode("split")}>
                    <MapPinned size={15} /> <span>نقشه</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pf-tools">
              <Link to="/favorites">
                <Heart size={14} /> ذخیره‌های من
              </Link>
              <Link to="/compare">
                <ArrowLeftRight size={14} /> مقایسه
              </Link>
              <button type="button" onClick={saveCurrentSearch} disabled={!hasFilters}>
                <Bookmark size={14} /> ذخیره جست‌وجو
              </button>
              <button type="button" onClick={() => void shareCurrentSearch()} disabled={!hasFilters}>
                <Share2 size={14} /> اشتراک‌گذاری
              </button>
              {savedSearches.length ? (
                <select
                  value={savedSearchId}
                  onChange={(event) => loadSavedSearch(event.target.value)}
                  aria-label="جست‌وجوهای ذخیره‌شده"
                >
                  <option value="">جست‌وجوهای ذخیره‌شده</option>
                  {savedSearches.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              ) : null}
              {savedSearchId ? (
                <button type="button" onClick={deleteSavedSearch}>
                  <X size={14} /> حذف جست‌وجوی ذخیره‌شده
                </button>
              ) : null}
              <Link to="/" hash="inquiry">
                درخواست فایل اختصاصی
              </Link>
            </div>

            {properties.length ? (
              <>
                {viewMode === "split" ? (
                  <div className="pf-map">
                    <div className="pf-map-list" aria-label="فهرست فایل‌های روی نقشه">
                      {properties.map((property) => (
                        <button
                          key={property.id}
                          type="button"
                          className={`pf-map-item${selectedPropertyId === property.id ? " is-active" : ""}`}
                          onClick={() => {
                            setSelectedPropertyId(property.id);
                            if (property.latitude == null || property.longitude == null) {
                              toast.info("برای این فایل مختصات نقشه ثبت نشده است.");
                            }
                          }}
                        >
                          <span className="pf-map-item-media">
                            {property.image ? <img src={property.image} alt="" loading="lazy" /> : <MapIcon size={20} />}
                          </span>
                          <span>
                            <strong>{property.title}</strong>
                            <small>
                              {property.neighborhood}
                              {property.areaM2 ? ` · ${fa(property.areaM2)} متر` : ""}
                            </small>
                          </span>
                          {property.latitude != null && property.longitude != null ? <MapPinned size={15} /> : null}
                        </button>
                      ))}
                    </div>
                    <div className="pf-map-panel" aria-label="نقشه فایل انتخاب‌شده">
                      {mapUrl ? (
                        <iframe
                          title={selectedProperty ? `نقشه ${selectedProperty.title}` : "نقشه فایل‌ها"}
                          src={mapUrl}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <div className="pf-empty">
                          <MapPinned size={28} />
                          <strong>برای نمایش نقشه، یک فایل دارای مختصات انتخاب کنید.</strong>
                          <p>مختصات فایل‌ها از پنل مدیریت قابل ثبت است.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`property-grid pf-grid${viewMode === "list" ? " is-list-view" : ""}`}>
                    {properties.map((property) => <PropertyCard key={property.id} property={property} />)}
                  </div>
                )}

                {properties.length < total ? (
                  <div className="pf-more">
                    <button type="button" className="btn-ghost" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore
                        ? "در حال بارگذاری…"
                        : `نمایش ${fa(Math.min(PAGE_SIZE, total - properties.length))} فایل بیشتر`}
                    </button>
                    <small>با اسکرول بیشتر، فایل‌های بعدی نیز خودکار بارگذاری می‌شوند.</small>
                    <div ref={loadMoreSentinel} aria-hidden="true" />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="pf-empty">
                <Search size={26} />
                <strong>فایلی با این معیارها پیدا نشد.</strong>
                <p>
                  بازه قیمت یا متراژ را بازتر کنید، فیلترهای کمتری انتخاب کنید، یا درخواست اختصاصی ثبت کنید تا
                  مشاور فایل مناسب را برایتان پیدا کند.
                </p>
                <div className="pf-empty-actions">
                  {hasFilters ? (
                    <button type="button" className="btn-ghost" onClick={resetFilters}>
                      <X size={15} /> پاک‌کردن فیلترها
                    </button>
                  ) : null}
                  <Link to="/" hash="inquiry" className="btn-gold">ثبت درخواست</Link>
                </div>
                <div className="pf-suggest" aria-label="پیشنهاد جست‌وجو">
                  <button
                    type="button"
                    className="pf-chip"
                    onClick={() => { setTransactionType("buy"); setPropertyType("apartment"); }}
                  >
                    خرید آپارتمان
                  </button>
                  <button
                    type="button"
                    className="pf-chip"
                    onClick={() => { setTransactionType("rent"); setPropertyType("apartment"); }}
                  >
                    اجاره آپارتمان
                  </button>
                  <button
                    type="button"
                    className="pf-chip"
                    onClick={() => { setTransactionType("buy"); setPropertyType("villa"); }}
                  >
                    خرید ویلا و باغ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
