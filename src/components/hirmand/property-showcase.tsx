import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CarFront,
  ChevronLeft,
  Home,
  MapPinned,
  Search,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES } from "@/lib/site";
import { formatToman } from "@/lib/money";
import type { Property, PropertyCardData, PropertyType, PropertyTransaction } from "@/lib/properties";
import { listPublishedPropertyCards } from "@/lib/properties";
import { PropertyActions } from "./property-actions";
import { Reveal } from "./reveal";

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartment: "آپارتمان", villa: "ویلا و باغ", office: "اداری", heritage: "خانه اصیل", land: "زمین", commercial: "تجاری",
};
const TRANSACTION_LABEL: Record<PropertyTransaction, string> = { buy: "خرید", sell: "فروش", rent: "اجاره", mortgage: "رهن" };
const FALLBACK_IMAGES: Record<PropertyType, string> = {
  apartment: "/images/type-apartment.jpg", villa: "/images/type-villa.jpg", office: "/images/type-office.jpg", heritage: "/images/type-heritage.jpg", land: "/images/type-villa.jpg", commercial: "/images/type-office.jpg",
};
function money(value: string | null) { if (!value) return ""; const parsed = Number(value); return Number.isFinite(parsed) ? formatToman(parsed) : value; }
function priceLabel(property: Property | PropertyCardData) {
  if (property.transactionType === "rent") return property.deposit ? `رهن ${money(property.deposit)} تومان${property.rent ? ` • اجاره ${money(property.rent)} تومان` : ""}` : property.rent ? `اجاره ${money(property.rent)} تومان` : "تماس برای قیمت";
  if (property.transactionType === "mortgage") return property.deposit ? `رهن ${money(property.deposit)} تومان` : "تماس برای قیمت";
  return property.price ? `قیمت ${money(property.price)} تومان` : "تماس برای قیمت";
}
function imageFor(property: Property | PropertyCardData) {
  if ("image" in property && property.image) return property.image;
  if ("images" in property && property.images[0]) return property.images[0];
  return FALLBACK_IMAGES[property.propertyType];
}

export function PropertyCard({ property }: { property: Property | PropertyCardData }) {
  return (
    <article className="property-card">
      <a
        href={`/properties/${encodeURIComponent(property.slug)}`}
        className="property-card-link"
        aria-label={`مشاهده جزئیات فایل ${property.title}`}
      >
        <div className="property-card-media">
          <img
            src={imageFor(property)}
            alt={property.title}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              const image = event.currentTarget;
              const source = image.dataset.source ?? image.src;
              if (image.dataset.proxy !== "2" && /divarcdn\.com/i.test(source)) {
                const proxyIndex = Number(image.dataset.proxy || "0");
                const proxies = [
                  `https://wsrv.nl/?url=${encodeURIComponent(source)}`,
                  `https://images.weserv.nl/?url=${encodeURIComponent(source)}`,
                ];
                if (proxyIndex < proxies.length) {
                  image.dataset.proxy = String(proxyIndex + 1);
                  image.src = proxies[proxyIndex];
                  return;
                }
              }
              if (image.dataset.fallback === "1") return;
              image.dataset.fallback = "1";
              image.src = FALLBACK_IMAGES[property.propertyType];
            }}
            referrerPolicy="no-referrer"
            data-source={imageFor(property)}
          />
          <div className="property-card-badges">
            {property.featured ? (
              <span className="property-badge property-badge-featured">ویژه</span>
            ) : null}
            {property.priceDropPercent && property.priceDropPercent > 0 ? (
              <span className="property-badge property-badge-discount">٪{property.priceDropPercent.toLocaleString("fa-IR")} کاهش</span>
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
          <span className="property-card-details-link">مشاهده جزئیات فایل <ChevronLeft size={14} /></span>
        </div>
      </a>

      <PropertyActions property={property} compact />
    </article>
  );
}
export function PropertyShowcase({ initialProperties }: { initialProperties: PropertyCardData[] }) {
  const [properties, setProperties] = useState(initialProperties); const [transactionType, setTransactionType] = useState(""); const [propertyType, setPropertyType] = useState(""); const [neighborhood, setNeighborhood] = useState(""); const [loading, setLoading] = useState(false);
  const neighborhoods = NEIGHBORHOOD_NAMES;
  async function applyFilters() { setLoading(true); try { const next = await listPublishedPropertyCards({ data: { transactionType: (transactionType || undefined) as PropertyTransaction | undefined, propertyType: (propertyType || undefined) as PropertyType | undefined, neighborhood: neighborhood || undefined } }); setProperties(next); } finally { setLoading(false); } }
  return <Reveal as="section" className="section property-showcase" id="listings"><SectionHead kicker="فایل‌های فعال" title="ملک‌های موجود هیرمند" text="فایل‌های منتشرشده را ببینید، جزئیات را باز کنید و برای هر ملک مستقیم با مشاور تماس بگیرید." />
    <div className="property-showcase-cta">
      <Link to="/properties" className="text-link">مشاهده همه فایل‌ها</Link>
      <Link to="/" hash="budget-match" className="text-link">جستجوی هوشمند بودجه</Link>
    </div>
    <div className="property-toolbar"><div className="property-toolbar-title"><span className="icon-box sm"><Search size={16} /></span><div><strong>جستجوی فایل</strong><small>{loading ? "در حال جستجو…" : `${properties.length.toLocaleString("fa-IR")} فایل نمایش داده می‌شود`}</small></div></div>
      <div className="property-filters"><label><span className="sr-only">نوع معامله</span><select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="">همه معاملات</option><option value="buy">خرید</option><option value="sell">فروش</option><option value="rent">اجاره</option><option value="mortgage">رهن</option></select></label>
        <label><span className="sr-only">نوع ملک</span><select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}><option value="">همه انواع ملک</option>{PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label><span className="sr-only">محله</span><select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="">همه محله‌ها</option>{neighborhoods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" className="btn-gold property-filter-button" onClick={applyFilters} disabled={loading}>{loading ? "در حال جستجو..." : "جستجو"}</button>
      </div></div>
    {properties.length ? <div className="property-grid">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <div className="property-empty"><MapPinned size={24} /><strong>فعلاً فایل منتشرشده‌ای با این فیلتر پیدا نشد.</strong><p>فیلترها را تغییر دهید یا درخواست ملک ثبت کنید تا مشاور فایل مناسب را برایتان پیدا کند.</p><div className="properties-empty-actions"><Link to="/" hash="inquiry" className="btn-gold">ثبت درخواست ملک</Link><Link to="/" hash="budget-match" className="btn-ghost">جستجوی بودجه</Link></div></div>}
  </Reveal>;
}
function SectionHead({ kicker, title, text }: { kicker: string; title: string; text?: string }) { return <div className="section-head"><span className="kicker">{kicker}</span><h2>{title}</h2>{text ? <p>{text}</p> : null}</div>; }
