import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { formatToman } from "@/lib/money";
import { propertyPath } from "@/lib/property-path";

const COMPARE_KEY = "hirmand-compare-properties";
const MAX_COMPARE = 3;

function readCompare(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: `مقایسه فایل‌ها | ${SITE.nameFa}` },
      { name: "description", content: "مقایسه هم‌زمان ویژگی‌ها و قیمت فایل‌های ملکی هیرمند." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ComparePage,
});

const PROPERTY_TYPE_LABEL: Record<Property["propertyType"], string> = {
  apartment: "آپارتمان",
  villa: "ویلا و باغ",
  office: "اداری",
  heritage: "خانه اصیل",
  land: "زمین",
  commercial: "تجاری",
};

function valueMoney(value: string | null) {
  if (!value) return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatToman(parsed) + " تومان" : value;
}
function valuePerM2(property: Property) {
  if ((property.transactionType !== "buy" && property.transactionType !== "sell") || !property.price || !property.areaM2 || property.areaM2 <= 0) return "—";
  const parsed = Number(property.price);
  return Number.isFinite(parsed) && parsed > 0 ? formatToman(Math.round(parsed / property.areaM2)) + " تومان" : "—";
}

function ComparePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  function removeFromCompare(slug: string) {
    const next = readCompare().filter((item) => item !== slug);
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures.
    }
    setProperties((current) => current.filter((property) => property.slug !== slug));
  }

  useEffect(() => {
    const slugs = readCompare();
    if (!slugs.length) {
      setLoading(false);
      return;
    }

    listPublishedPropertiesBySlugs({ data: { slugs } })
      .then(setProperties)
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, []);

  function clearCompare() {
    try {
      localStorage.removeItem(COMPARE_KEY);
    } catch {
      // Ignore storage failures.
    }
    setProperties([]);
  }

  return (
    <SiteChrome className="property-detail-shell">
      <main className="compare-page">
        <header className="favorites-head">
          <div>
            <span className="kicker">انتخاب هوشمند</span>
            <h1>مقایسه فایل‌ها</h1>
            <p>تا ۳ فایل را کنار هم ببینید تا تفاوت قیمت، متراژ، امکانات و موقعیت را سریع‌تر بررسی کنید.</p>
          </div>
          <ArrowLeftRight size={30} />
        </header>

        {loading ? (
          <section className="property-empty">
            <strong>در حال آماده‌سازی مقایسه…</strong>
          </section>
        ) : properties.length < 2 ? (
          <section className="property-empty">
            <ArrowLeftRight size={28} />
            <strong>برای مقایسه حداقل ۲ فایل انتخاب کنید.</strong>
            <p>در صفحه فایل‌ها یا روی کارت ملک، دکمه «مقایسه» را بزنید.</p>
            <div className="properties-empty-actions">
              <Link to="/properties" className="btn-gold">مشاهده فایل‌ها</Link>
              {properties.length ? <a href={propertyPath(properties[0]!)} className="btn-ghost">مشاهده فایل انتخاب‌شده</a> : null}
            </div>
          </section>
        ) : (
          <>
            <div className="compare-toolbar">
              <span>{properties.length.toLocaleString("fa-IR")} فایل انتخاب شده</span>
              <button type="button" className="properties-reset-btn" onClick={clearCompare}>
                <Trash2 size={14} /> پاک‌کردن مقایسه
              </button>
            </div>

            <div className="compare-grid">
              {properties.map((property) => (
                <div key={property.id} className="compare-card">
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>

            <div className="compare-table-wrap">
              <table className="compare-table">
                <tbody>
                  <tr>
                    <th>نوع معامله</th>
                    {properties.map((p) => <td key={p.id}>{p.transactionType === "sell" ? "فروش" : p.transactionType === "buy" ? "خرید" : p.transactionType === "rent" ? "اجاره" : "رهن"}</td>)}
                  </tr>
                  <tr>
                    <th>نوع ملک</th>
                    {properties.map((p) => <td key={p.id}>{PROPERTY_TYPE_LABEL[p.propertyType] ?? p.propertyType}</td>)}
                  </tr>
                  <tr>
                    <th>محله</th>
                    {properties.map((p) => <td key={p.id}>{p.neighborhood}</td>)}
                  </tr>
                  <tr>
                    <th>متراژ</th>
                    {properties.map((p) => <td key={p.id}>{p.areaM2 != null ? p.areaM2.toLocaleString("fa-IR") + " متر" : "—"}</td>)}
                  </tr>
                  <tr>
                    <th>خواب</th>
                    {properties.map((p) => <td key={p.id}>{p.bedrooms != null ? p.bedrooms.toLocaleString("fa-IR") : "—"}</td>)}
                  </tr>
                  <tr>
                    <th>طبقه</th>
                    {properties.map((p) => <td key={p.id}>{p.floor != null ? p.floor.toLocaleString("fa-IR") : "—"}</td>)}
                  </tr>
                  <tr>
                    <th>پارکینگ</th>
                    {properties.map((p) => <td key={p.id}>{p.parking ? "دارد" : "ندارد"}</td>)}
                  </tr>
                  <tr>
                    <th>آسانسور</th>
                    {properties.map((p) => <td key={p.id}>{p.elevator ? "دارد" : "ندارد"}</td>)}
                  </tr>
                  <tr>
                    <th>انباری</th>
                    {properties.map((p) => <td key={p.id}>{p.storage ? "دارد" : "ندارد"}</td>)}
                  </tr>
                  <tr>
                    <th>قیمت هر متر</th>
                    {properties.map((p) => <td key={p.id}>{valuePerM2(p)}</td>)}
                  </tr>
                  <tr>
                    <th>قیمت فروش</th>
                    {properties.map((p) => <td key={p.id}>{valueMoney(p.price)}</td>)}
                  </tr>
                  <tr>
                    <th>رهن</th>
                    {properties.map((p) => <td key={p.id}>{valueMoney(p.deposit)}</td>)}
                  </tr>
                  <tr>
                    <th>اجاره</th>
                    {properties.map((p) => <td key={p.id}>{valueMoney(p.rent)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="compare-actions">
              {properties.map((property) => (
                <div key={property.id}>
                  <strong>{property.title}</strong>
                  <button
                    type="button"
                    className="properties-reset-btn"
                    onClick={() => removeFromCompare(property.slug)}
                  >
                    <Trash2 size={14} /> حذف از مقایسه
                  </button>
                </div>
              ))}
            </div>

            <div className="property-empty" style={{ marginTop: 24 }}>
              <Heart size={22} />
              <strong>برای دیدن گزینه‌های بیشتر، به فهرست فایل‌ها برگردید.</strong>
              <Link to="/properties" className="btn-gold">جستجوی فایل‌های بیشتر</Link>
            </div>
          </>
        )}
      </main>
    </SiteChrome>
  );
}
