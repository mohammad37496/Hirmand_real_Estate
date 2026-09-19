import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
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

export const Route = createFileRoute("/properties")({
  loader: () => listPublishedProperties({ data: {} }),
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
  const value = Number(toEnglishDigits(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function PropertiesIndexPage() {
  const initialProperties = Route.useLoaderData();
  const [properties, setProperties] = useState(initialProperties);
  const [total, setTotal] = useState(initialProperties.length);
  const [q, setQ] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<PropertySort>("newest");
  const [loading, setLoading] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    setQ(params.get("q") ?? "");
    const transactionParam = params.get("transaction");
    const propertyTypeParam = params.get("type");
    setTransactionType(
      transactionParam === "buy" || transactionParam === "sell" || transactionParam === "rent" || transactionParam === "mortgage"
        ? transactionParam
        : "",
    );
    setPropertyType(
      propertyTypeParam === "apartment" ||
      propertyTypeParam === "villa" ||
      propertyTypeParam === "office" ||
      propertyTypeParam === "heritage" ||
      propertyTypeParam === "land" ||
      propertyTypeParam === "commercial"
        ? propertyTypeParam
        : "",
    );
    setNeighborhood(params.get("neighborhood") ?? "");
    setMinArea(params.get("minArea") ?? "");
    setMaxArea(params.get("maxArea") ?? "");
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
    setSort((params.get("sort") as PropertySort) || "newest");
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
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = {
          search: q.trim() || undefined,
          transactionType: (transactionType || undefined) as PropertyTransaction | undefined,
          propertyType: (propertyType || undefined) as PropertyType | undefined,
          neighborhood: neighborhood || undefined,
          minArea: parseNumber(minArea),
          maxArea: parseNumber(maxArea),
          minPrice: parseNumber(minPrice),
          maxPrice: parseNumber(maxPrice),
          sort,
        } as const;
        const [rows, count] = await Promise.all([
          listPublishedProperties({ data }),
          countPublishedProperties({ data }),
        ]);
        setProperties(rows);
        setTotal(count);
      } catch {
        // Keep the last successful result visible; the page should remain usable during a transient request failure.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [q, transactionType, propertyType, neighborhood, minArea, maxArea, minPrice, maxPrice, sort]);

  const hasFilters = Boolean(
    q.trim() ||
    transactionType ||
    propertyType ||
    neighborhood ||
    minArea.trim() ||
    maxArea.trim() ||
    minPrice.trim() ||
    maxPrice.trim() ||
    sort !== "newest",
  );

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
  }

  return (
    <SiteChrome>
      <main className="page-shell properties-index-page">
        <section className="section properties-index-hero">
          <div className="properties-index-heading">
            <div>
              <span className="kicker">فایل‌های هیرمند</span>
              <h1>فایل‌های ملکی اصفهان</h1>
              <p>جست‌وجوی سریع بین فایل‌های فعال؛ بر اساس نوع معامله، نوع ملک، محله، متراژ و بازه قیمت.</p>
            </div>
            {loading ? <span className="properties-loading-pill">در حال جست‌وجو…</span> : null}
          </div>

          <div className="properties-filter-panel">
            <label className="properties-filter-search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="عنوان، محله یا آدرس…" />
            </label>

            <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} aria-label="نوع معامله">
              <option value="">همه معاملات</option>
              {SERVICES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>

            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} aria-label="نوع ملک">
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
              <input inputMode="numeric" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="مثلاً ۸۰" />
            </label>
            <label className="properties-range-field">
              <span>حداکثر متراژ</span>
              <input inputMode="numeric" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="مثلاً ۲۵۰" />
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
            <span><SlidersHorizontal size={15} /> {total.toLocaleString("fa-IR")} فایل{total > properties.length ? " · نمایش ۴۸ فایل اول" : ""}</span>
            <div className="properties-result-actions">
              {hasFilters ? (
                <button type="button" className="properties-reset-btn" onClick={resetFilters}>
                  <RotateCcw size={14} /> پاک‌کردن فیلترها
                </button>
              ) : null}
              <a href="/#inquiry">درخواست فایل اختصاصی</a>
            </div>
          </div>

          {properties.length ? (
            <div className="property-grid">
              {properties.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="property-empty">
              <Search size={25} />
              <strong>فایلی با این معیارها پیدا نشد.</strong>
              <p>بازه قیمت یا متراژ را بازتر کنید یا درخواست اختصاصی ثبت کنید تا مشاوران گزینه مناسب را پیدا کنند.</p>
              <div className="properties-empty-actions">
                <button type="button" className="btn-ghost" onClick={resetFilters}><X size={15} /> پاک‌کردن فیلترها</button>
                <a href="/#inquiry" className="btn-gold">ثبت درخواست</a>
              </div>
            </div>
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
