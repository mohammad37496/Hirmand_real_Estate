import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Heart, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import {
  countPublishedProperties,
  listPublishedProperties,
  type PropertySort,
  type PropertyTransaction,
  type PropertyType,
} from "@/lib/properties";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PROPERTY_TYPES, NEIGHBORHOOD_NAMES, SERVICES, SITE } from "@/lib/site";

const PAGE_SIZE = 48;
const SAVED_SEARCHES_KEY = "hirmand-saved-searches";
const MAX_SAVED_SEARCHES = 10;

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
        listPublishedProperties({ data: {} }),
        countPublishedProperties({ data: {} }),
      ]);
      return { properties, total };
    } catch (error) {
      console.error("[properties] loader failed", error);
      return { properties: [], total: 0 };
    }
  },
  head: () => ({
    meta: [
      { title: "فایل‌های ملکی اصفهان | هیرمند" },
      { name: "description", content: "فایل‌های منتشرشده خرید، فروش، رهن و اجاره در اصفهان از گروه مشاورین املاک هیرمند." },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/properties` }],
  }),
  component: PropertiesIndexPage,
});

function toEnglishDigits(raw: string) {
  return raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
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
  sort: PropertySort,
  offset: number,
) {
  const [nextMinArea, nextMaxArea] = normalizeBounds(minArea, maxArea);
  const [nextMinPrice, nextMaxPrice] = normalizeBounds(minPrice, maxPrice);
  return {
    search: q.trim() || undefined,
    transactionType: transactionType || undefined,
    propertyType: propertyType || undefined,
    neighborhood: neighborhood || undefined,
    minArea: nextMinArea,
    maxArea: nextMaxArea,
    minPrice: nextMinPrice,
    maxPrice: nextMaxPrice,
    sort,
    offset,
  };
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
  const [sort, setSort] = useState<PropertySort>("newest");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchId, setSavedSearchId] = useState("");
  const skipInitialFetch = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    setSavedSearches(readSavedSearches());
    const params = new URLSearchParams(window.location.search);
    const tx = validTransaction(params.get("transaction") ?? "");
    const type = validPropertyType(params.get("type") ?? "");
    const sortParam = params.get("sort");
    const validSort =
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
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/properties?${query}` : "/properties");
  }, [urlReady, q, transactionType, propertyType, neighborhood, minArea, maxArea, minPrice, maxPrice, sort]);

  useEffect(() => {
    if (!urlReady || skipInitialFetch.current) {
      if (urlReady) skipInitialFetch.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setOffset(0);
      try {
        const data = buildFilterData(
          q,
          transactionType,
          propertyType,
          neighborhood,
          minArea,
          maxArea,
          minPrice,
          maxPrice,
          sort,
          0,
        );
        const [rows, count] = await Promise.all([
          listPublishedProperties({ data }),
          countPublishedProperties({ data }),
        ]);
        if (requestId.current !== currentRequest) return;
        setProperties(rows);
        setTotal(count);
      } catch {
        // Keep the last successful result visible.
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [urlReady, q, transactionType, propertyType, neighborhood, minArea, maxArea, minPrice, maxPrice, sort]);

  async function loadMore() {
    if (loading || loadingMore || properties.length >= total) return;
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const rows = await listPublishedProperties({
        data: buildFilterData(
          q,
          transactionType,
          propertyType,
          neighborhood,
          minArea,
          maxArea,
          minPrice,
          maxPrice,
          sort,
          nextOffset,
        ),
      });
      setProperties((current) => [...current, ...rows]);
      setOffset(nextOffset);
    } catch {
      // Keep current page visible.
    } finally {
      setLoadingMore(false);
    }
  }

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
    setSort("newest");
    setOffset(0);
  }

  const hasFilters = Boolean(
    q.trim() ||
    transactionType ||
    propertyType ||
    neighborhood ||
    minArea.trim() ||
    maxArea.trim() ||
    minPrice.trim() ||
    maxPrice.trim() ||
    sort !== "newest"
  );

  return (
    <SiteChrome>
      <main className="page-shell properties-index-page">
        <section className="section properties-index-hero">
          <div className="properties-index-heading">
            <div>
              <span className="kicker">فایل‌های هیرمند</span>
              <h1>فایل‌های ملکی اصفهان</h1>
              <p>جست‌وجوی سریع بین فایل‌های فعال؛ بر اساس معامله، نوع ملک، محله، متراژ و بازه قیمت.</p>
            </div>
            {loading ? <span className="properties-loading-pill">در حال جست‌وجو…</span> : null}
          </div>

          <div className="properties-filter-panel">
            <label className="properties-filter-search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="عنوان، محله یا آدرس…" aria-label="جستجوی فایل" />
            </label>
            <select value={transactionType} onChange={(e) => setTransactionType(validTransaction(e.target.value) ?? "")} aria-label="نوع معامله">
              <option value="">همه معاملات</option>
              {SERVICES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <select value={propertyType} onChange={(e) => setPropertyType(validPropertyType(e.target.value) ?? "")} aria-label="نوع ملک">
              <option value="">همه انواع ملک</option>
              {PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              <option value="land">زمین</option>
              <option value="commercial">تجاری</option>
            </select>
            <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} aria-label="محله">
              <option value="">همه محله‌ها</option>
              {NEIGHBORHOOD_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="properties-range-field">
              <span>حداقل متراژ</span>
              <input inputMode="numeric" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="۸۰" />
            </label>
            <label className="properties-range-field">
              <span>حداکثر متراژ</span>
              <input inputMode="numeric" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="۲۵۰" />
            </label>
            <label className="properties-range-field">
              <span>حداقل قیمت</span>
              <input inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="تومان" />
            </label>
            <label className="properties-range-field">
              <span>حداکثر قیمت</span>
              <input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="تومان" />
            </label>
            <label className="properties-sort-field">
              <span>مرتب‌سازی</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as PropertySort)}>
                <option value="newest">جدیدترین</option>
                <option value="price_asc">ارزان‌ترین</option>
                <option value="price_desc">گران‌ترین</option>
                <option value="area_asc">کمترین متراژ</option>
                <option value="area_desc">بیشترین متراژ</option>
              </select>
            </label>
          </div>

          <div className="properties-result-meta">
            <span><SlidersHorizontal size={15} /> نمایش {properties.length.toLocaleString("fa-IR")} از {total.toLocaleString("fa-IR")} فایل</span>
            <div className="properties-result-actions">
              {hasFilters ? (
                <button type="button" className="properties-reset-btn" onClick={resetFilters}>
                  <RotateCcw size={14} /> پاک‌کردن فیلترها
                </button>
              ) : null}
              <Link to="/favorites" className="properties-saved-link">
                <Heart size={14} /> ذخیره‌های من
              </Link>
              <Link to="/compare" className="properties-saved-link">
                <ArrowLeftRight size={14} /> مقایسه فایل‌ها
              </Link>
              <button
                type="button"
                className="properties-reset-btn"
                onClick={saveCurrentSearch}
                disabled={!hasFilters}
              >
                ذخیره جست‌وجو
              </button>
              {savedSearches.length ? (
                <>
                  <select
                    className="properties-saved-search-select"
                    value={savedSearchId}
                    onChange={(event) => loadSavedSearch(event.target.value)}
                    aria-label="جست‌وجوهای ذخیره‌شده"
                  >
                    <option value="">جست‌وجوهای ذخیره‌شده</option>
                    {savedSearches.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="properties-reset-btn"
                    onClick={deleteSavedSearch}
                    disabled={!savedSearchId}
                  >
                    حذف جست‌وجوی ذخیره‌شده
                  </button>
                </>
              ) : null}
              <a href="/#inquiry">درخواست فایل اختصاصی</a>
            </div>
          </div>

          {properties.length ? (
            <>
              <div className="property-grid">
                {properties.map((property) => <PropertyCard key={property.id} property={property} />)}
              </div>
              {properties.length < total ? (
                <div className="properties-load-more">
                  <button type="button" className="btn-ghost" onClick={() => void loadMore()} disabled={loadingMore}>
                    {loadingMore ? "در حال بارگذاری…" : `نمایش ${Math.min(PAGE_SIZE, total - properties.length).toLocaleString("fa-IR")} فایل بیشتر`}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="property-empty">
              <Search size={25} />
              <strong>فایلی با این معیارها پیدا نشد.</strong>
              <p>بازه قیمت یا متراژ را بازتر کنید یا درخواست اختصاصی ثبت کنید تا مشاوران گزینه مناسب را پیدا کنند.</p>
              <div className="properties-empty-actions">
                {hasFilters ? <button type="button" className="btn-ghost" onClick={resetFilters}><X size={15} /> پاک‌کردن فیلترها</button> : null}
                <a href="/#inquiry" className="btn-gold">ثبت درخواست</a>
              </div>
            </div>
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
