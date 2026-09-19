import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { listPublishedProperties } from "@/lib/properties";
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


function PropertiesIndexPage() {
  const properties = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  const filtered = properties.filter((property) => {
    const query = q.trim().toLowerCase();
    return (
      (!query ||
        property.title.toLowerCase().includes(query) ||
        property.neighborhood.toLowerCase().includes(query) ||
        (property.address ?? "").toLowerCase().includes(query)) &&
      (!transactionType || property.transactionType === transactionType) &&
      (!propertyType || property.propertyType === propertyType) &&
      (!neighborhood || property.neighborhood === neighborhood)
    );
  });

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
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی عنوان، محله یا آدرس…" />
            </label>
            <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
              <option value="">همه معاملات</option>
              {SERVICES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              <option value="">همه انواع ملک</option>
              {PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
              <option value="">همه محله‌ها</option>
              {NEIGHBORHOOD_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="properties-result-meta">
            <span><SlidersHorizontal size={15} /> {filtered.length.toLocaleString("fa-IR")} فایل</span>
            <a href="/#inquiry">درخواست فایل اختصاصی</a>
          </div>

          {filtered.length ? (
            <div className="property-grid">
              {filtered.map((property) => <PropertyCard key={property.id} property={property} />)}
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
