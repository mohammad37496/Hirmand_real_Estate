import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  Building2,
  CarFront,
  ChevronLeft,
  MapPinned,
  Ruler,
  Search,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES } from "@/lib/site";
import { mediaSourceCandidates } from "@/lib/media";
import { formatToman } from "@/lib/money";
import type { Property, PropertyCardData, PropertyType, PropertyTransaction } from "@/lib/properties";
import { isFeaturedActive, listPublishedPropertyCards } from "@/lib/properties";
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
function unitPriceLabel(property: Property | PropertyCardData) {
  if ((property.transactionType !== "buy" && property.transactionType !== "sell") || !property.price || !property.areaM2 || property.areaM2 <= 0) return "";
  const price = Number(property.price);
  if (!Number.isFinite(price) || price <= 0) return "";
  return `هر متر ${formatToman(Math.round(price / property.areaM2))} تومان`;
}
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


function PropertyImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const candidates = mediaSourceCandidates(src, fallback);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[Math.min(attempt, candidates.length - 1)] ?? fallback;
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setAttempt((value) => Math.min(value + 1, candidates.length - 1))}
    />
  );
}
export function PropertyCard({ property }: { property: Property | PropertyCardData }) {
  const image = imageFor(property);
  const transaction = TRANSACTION_LABEL[property.transactionType];
  const type = PROPERTY_TYPE_LABEL[property.propertyType];
  const code = property.id.slice(-6).toUpperCase();

  return (
    <article className="property-card">
      <Link
        to="/file/$id"
        params={{ id: property.id }}
        className="property-card-link"
        data-property-link="true"
        aria-label={`مشاهده جزئیات کامل فایل ${property.title}`}
      >
        <div className="property-card-media">
          <PropertyImage
            src={image}
            alt={property.title}
            fallback={FALLBACK_IMAGES[property.propertyType]}
          />
          <div className="property-card-badges">
            {isFeaturedActive(property) ? (
              <span className="property-badge property-badge-featured">ویژه</span>
            ) : null}
            <span className="property-badge">{transaction}</span>
          </div>
          {property.priceDropPercent && property.priceDropPercent > 0 ? (
            <span className="property-badge property-badge-discount">
              ٪{property.priceDropPercent.toLocaleString("fa-IR")} کاهش
            </span>
          ) : null}
          <span className="property-card-image-count" aria-label={`${type} · ${property.neighborhood}`}>
            <span>{type}</span>
            <span>اصفهان، {property.neighborhood}</span>
          </span>
          <span className="property-card-arrow" aria-hidden="true">
            <ChevronLeft size={16} />
          </span>
        </div>

        <div className="property-card-body">
          <div className="property-card-topline">
            <div className="property-card-meta">
              <span>{transaction}</span>
              <span>{type}</span>
              <span>{property.neighborhood}</span>
            </div>
            <span className="property-card-code">کد {code}</span>
          </div>

          <h3>{property.title}</h3>

          <div className="property-card-price-row">
            <p className="property-card-price">{priceLabel(property)}</p>
            {unitPriceLabel(property) ? (
              <span className="property-card-unit-price">{unitPriceLabel(property)}</span>
            ) : null}
          </div>

          <div className="property-card-specs" aria-label="مشخصات خلاصه">
            {property.areaM2 ? (
              <span><Ruler size={14} /> {property.areaM2.toLocaleString("fa-IR")} متر</span>
            ) : null}
            {property.bedrooms ? (
              <span><BedDouble size={14} /> {property.bedrooms.toLocaleString("fa-IR")} خواب</span>
            ) : null}
            {property.parking ? (
              <span><CarFront size={14} /> پارکینگ</span>
            ) : null}
            {property.elevator ? (
              <span><Building2 size={14} /> آسانسور</span>
            ) : null}
          </div>

          <div className="property-card-footer">
            <span className="property-card-location">
              <MapPinned size={14} /> {property.neighborhood}
            </span>
            <span className="property-card-details-link">
              جزئیات فایل <ChevronLeft size={14} />
            </span>
          </div>
        </div>
      </Link>

      <div className="property-card-actions" aria-label="عملیات فایل">
        <PropertyActions property={property} compact />
      </div>
    </article>
  );
}

export function PropertyShowcase({ initialProperties = [] }: { initialProperties?: PropertyCardData[] }) {
  const [properties, setProperties] = useState(initialProperties);
  const [transactionType, setTransactionType] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [loading, setLoading] = useState(false);
  const neighborhoods = NEIGHBORHOOD_NAMES;

  useEffect(() => {
    let cancelled = false;
    void listPublishedPropertyCards({ data: {} })
      .then((next) => {
        if (!cancelled) setProperties(next);
      })
      .catch(() => {
        // The public marketing page must remain usable without a database.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function applyFilters() {
    setLoading(true);
    try {
      const next = await listPublishedPropertyCards({
        data: {
          transactionType: (transactionType || undefined) as PropertyTransaction | undefined,
          propertyType: (propertyType || undefined) as PropertyType | undefined,
          neighborhood: neighborhood || undefined,
        },
      });
      setProperties(next);
    } catch {
      toast.error("جستجوی فایل‌ها انجام نشد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }
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
