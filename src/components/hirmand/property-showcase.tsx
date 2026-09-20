import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CarFront,
  ChevronLeft,
  Heart,
  Home,
  MapPinned,
  Search,
  Share2,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES } from "@/lib/site";
import { formatToman } from "@/lib/money";
import type { Property, PropertyType, PropertyTransaction } from "@/lib/properties";
import { listPublishedProperties } from "@/lib/properties";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { Reveal } from "./reveal";

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: "آپارتمان", villa: "ویلا و باغ", office: "اداری", heritage: "خانه اصیل", land: "زمین", commercial: "تجاری",
};
const TRANSACTION_LABEL: Record<PropertyTransaction, string> = { buy: "خرید", sell: "فروش", rent: "اجاره", mortgage: "رهن" };
const FALLBACK_IMAGES: Record<PropertyType, string> = {
  apartment: "/images/type-apartment.jpg", villa: "/images/type-villa.jpg", office: "/images/type-office.jpg", heritage: "/images/type-heritage.jpg", land: "/images/type-villa.jpg", commercial: "/images/type-office.jpg",
};
function money(value: string | null) { if (!value) return ""; const parsed = Number(value); return Number.isFinite(parsed) ? formatToman(parsed) : value; }
function priceLabel(property: Property) {
  if (property.transactionType === "rent") return property.deposit ? `رهن ${money(property.deposit)} تومان${property.rent ? ` • اجاره ${money(property.rent)} تومان` : ""}` : property.rent ? `اجاره ${money(property.rent)} تومان` : "تماس برای قیمت";
  if (property.transactionType === "mortgage") return property.deposit ? `رهن ${money(property.deposit)} تومان` : "تماس برای قیمت";
  return property.price ? `قیمت ${money(property.price)} تومان` : "تماس برای قیمت";
}
function imageFor(property: Property) { return property.images[0] || FALLBACK_IMAGES[property.propertyType]; }

const FAVORITES_KEY = "hirmand-favorite-properties";

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toggleFavorite(slug: string): boolean {
  const current = readFavorites();
  const exists = current.includes(slug);
  const next = exists ? current.filter((item) => item !== slug) : [...current, slug];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next.slice(-100)));
  } catch {
    // Favorites are optional; ignore storage failures.
  }
  return !exists;
}

async function shareProperty(property: Property) {
  const url = new URL(`/properties/${property.slug}`, window.location.origin).toString();
  const shareData = { title: property.title, text: `فایل «${property.title}» در هیرمند`, url };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(url);
      alert("لینک فایل کپی شد.");
    }
    trackAnalyticsEvent("property_share", property.slug);
  } catch {
    // User cancelled the native share sheet.
  }
}

export function PropertyCard({ property }: { property: Property }) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(readFavorites().includes(property.slug));
  }, [property.slug]);

  function onFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleFavorite(property.slug);
    setFavorite(next);
    trackAnalyticsEvent("property_favorite", property.slug);
  }

  function onShare(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void shareProperty(property);
  }

  return (
    <article className="property-card">
      <Link
        to="/properties/$slug"
        params={{ slug: property.slug }}
        className="property-card-link"
      >
        <div className="property-card-media">
          <img
            src={imageFor(property)}
            alt={property.title}
            loading="lazy"
            decoding="async"
          />
          <div className="property-card-badges">
            {property.featured ? (
              <span className="property-badge property-badge-featured">ویژه</span>
            ) : null}
            <span className="property-badge">
              {TRANSACTION_LABEL[property.transactionType]}
            </span>
          </div>
          <span className="property-card-arrow" aria-hidden="true">
            <ChevronLeft size={16} />
          </span>
</div>

        <div className="property-card-body">
          <div className="property-card-meta">
            <span>{PROPERTY_TYPE_LABEL[property.propertyType]}</span>
            <span>{property.neighborhood}</span>
          </div>
          <h3>{property.title}</h3>
          <p className="property-card-price">{priceLabel(property)}</p>
          <div className="property-card-specs">
            {property.areaM2 ? (
              <span>
                <Home size={14} /> {property.areaM2.toLocaleString("fa-IR")} متر
              </span>
            ) : null}
            {property.bedrooms ? (
              <span>
                <Building2 size={14} /> {property.bedrooms.toLocaleString("fa-IR")} خواب
              </span>
            ) : null}
            {property.parking ? (
              <span>
                <CarFront size={14} /> پارکینگ
              </span>
            ) : null}
            {property.elevator ? (
              <span>
                <Building2 size={14} /> آسانسور
              </span>
            ) : null}
          </div>
        </div>
      <div className="property-card-actions">
        <button
          type="button"
          className={`property-card-action${favorite ? " is-active" : ""}`}
          onClick={onFavorite}
          aria-label={favorite ? "حذف از ذخیره‌ها" : "ذخیره فایل"}
          aria-pressed={favorite}
          title={favorite ? "حذف از ذخیره‌ها" : "ذخیره فایل"}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className="property-card-action"
          onClick={onShare}
          aria-label="اشتراک‌گذاری فایل"
          title="اشتراک‌گذاری"
        >
          <Share2 size={16} />
        </button>
      </div>

      </Link>
    </article>
  );
}
export function PropertyShowcase({ initialProperties }: { initialProperties: Property[] }) {
  const [properties, setProperties] = useState(initialProperties); const [transactionType, setTransactionType] = useState(""); const [propertyType, setPropertyType] = useState(""); const [neighborhood, setNeighborhood] = useState(""); const [loading, setLoading] = useState(false);
  const neighborhoods = NEIGHBORHOOD_NAMES;
  async function applyFilters() { setLoading(true); try { const next = await listPublishedProperties({ data: { transactionType: (transactionType || undefined) as PropertyTransaction | undefined, propertyType: (propertyType || undefined) as PropertyType | undefined, neighborhood: neighborhood || undefined } }); setProperties(next); } finally { setLoading(false); } }
  return <Reveal as="section" className="section property-showcase" id="listings"><SectionHead kicker="فایل‌های فعال" title="ملک‌های موجود هیرمند" text="فایل‌های منتشرشده را ببینید، جزئیات را باز کنید و برای هر ملک مستقیم با مشاور تماس بگیرید." />
    <div className="property-toolbar"><div className="property-toolbar-title"><span className="icon-box sm"><Search size={16} /></span><div><strong>جستجوی فایل</strong><small>{loading ? "در حال جستجو…" : `${properties.length.toLocaleString("fa-IR")} فایل نمایش داده می‌شود`}</small></div></div>
      <div className="property-filters"><label><span className="sr-only">نوع معامله</span><select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="">همه معاملات</option><option value="buy">خرید</option><option value="sell">فروش</option><option value="rent">اجاره</option><option value="mortgage">رهن</option></select></label>
        <label><span className="sr-only">نوع ملک</span><select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}><option value="">همه انواع ملک</option>{PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label><span className="sr-only">محله</span><select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="">همه محله‌ها</option>{neighborhoods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" className="btn-gold property-filter-button" onClick={applyFilters} disabled={loading}>{loading ? "در حال جستجو..." : "جستجو"}</button>
      </div></div>
    {properties.length ? <div className="property-grid">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <div className="property-empty"><MapPinned size={24} /><strong>فعلاً فایل منتشرشده‌ای با این فیلتر پیدا نشد.</strong><p>فیلترها را تغییر دهید یا درخواست ملک ثبت کنید تا مشاور فایل مناسب را برایتان پیدا کند.</p><Link to="/" hash="inquiry" className="btn-gold">ثبت درخواست ملک</Link></div>}
  </Reveal>;
}
function SectionHead({ kicker, title, text }: { kicker: string; title: string; text?: string }) { return <div className="section-head"><span className="kicker">{kicker}</span><h2>{title}</h2>{text ? <p>{text}</p> : null}</div>; }
