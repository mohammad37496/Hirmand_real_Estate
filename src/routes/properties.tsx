import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Search, SlidersHorizontal } from "lucide-react";
import { listPublishedProperties } from "@/lib/properties";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PROPERTY_TYPES, NEIGHBORHOOD_NAMES, SERVICES, SITE } from "@/lib/site";

function normalizeSearch(search: Record<string, unknown>) {
  const q = typeof search.q === "string" ? search.q.trim().slice(0, 80) : "";
  const transactionType = ["buy", "sell", "rent", "mortgage"].includes(String(search.transactionType))
    ? (String(search.transactionType) as "buy" | "sell" | "rent" | "mortgage")
    : "";
  const propertyType = ["apartment", "villa", "office", "heritage", "land", "commercial"].includes(String(search.propertyType))
    ? (String(search.propertyType) as "apartment" | "villa" | "office" | "heritage" | "land" | "commercial")
    : "";
  const neighborhood = typeof search.neighborhood === "string" ? search.neighborhood.trim().slice(0, 80) : "";
  return { q, transactionType, propertyType, neighborhood };
}

export const Route = createFileRoute("/properties")({
  validateSearch: normalizeSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) =>
    listPublishedProperties({
      data: {
        search: deps.q || undefined,
        transactionType: deps.transactionType ? (deps.transactionType as "buy" | "sell" | "rent" | "mortgage") : undefined,
        propertyType: deps.propertyType ? (deps.propertyType as "apartment" | "villa" | "office" | "heritage" | "land" | "commercial") : undefined,
        neighborhood: deps.neighborhood || undefined,
      },
    }),
  head: () => ({
    meta: [
      { title: "فایل‌های ملکی اصفهان | هیرمند" },
      { name: "description", content: "فایل‌های منتشرشده خرید، فروش، رهن و اجاره در اصفهان از گروه مشاورین املاک هیرمند." },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/properties` }],
  }),
  component: PropertiesIndexPage,
});

function PropertiesIndexPage() {
  const properties = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  function update(values: Partial<typeof search>) {
    void navigate({
      search: (prev) => ({ ...prev, ...values }),
      replace: true,
    });
  }

  return (
    <SiteChrome>
      <main className="page-shell properties-index-page">
        <section className="section properties-index-hero">
          <span className="kicker">فایل‌های هیرمند</span>
          <h1>فایل‌های ملکی اصفهان</h1>
          <p>فایل‌های فعال را بر اساس نوع معامله، نوع ملک و محله پیدا کنید.</p>

          <div className="properties-filter-panel">
            <label className="admin-search">
              <Search size={17} />
              <input
                value={search.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="جستجوی عنوان، محله یا آدرس…"
              />
            </label>
            <select value={search.transactionType} onChange={(e) => update({ transactionType: e.target.value as typeof search.transactionType })}>
              <option value="">همه معاملات</option>
              {SERVICES.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <select value={search.propertyType} onChange={(e) => update({ propertyType: e.target.value as typeof search.propertyType })}>
              <option value="">همه انواع ملک</option>
              {PROPERTY_TYPES.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <select value={search.neighborhood} onChange={(e) => update({ neighborhood: e.target.value })}>
              <option value="">همه محله‌ها</option>
              {NEIGHBORHOOD_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="properties-result-meta">
            <span><SlidersHorizontal size={15} /> {properties.length.toLocaleString("fa-IR")} فایل</span>
            <a href="/#inquiry">درخواست فایل اختصاصی</a>
          </div>

          {properties.length ? (
            <div className="property-grid">
              {properties.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="property-empty">
              <Search size={25} />
              <strong>فایلی با این معیارها پیدا نشد.</strong>
              <p>فیلترها را تغییر دهید یا درخواست اختصاصی ثبت کنید تا مشاوران گزینه مناسب را پیدا کنند.</p>
              <a href="/#inquiry" className="btn-gold">ثبت درخواست</a>
            </div>
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
