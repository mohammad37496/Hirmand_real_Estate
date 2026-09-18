import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BedDouble, Building2, CarFront, Check, Elevator, MapPinned, Phone, Ruler, Warehouse } from "lucide-react";
import { getPublishedProperty } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { formatToman } from "@/lib/money";

export const Route = createFileRoute("/properties/$slug")({
  loader: ({ params }) => getPublishedProperty({ data: { slug: params.slug } }),
  head: () => ({ meta: [
    { title: `ملک | ${SITE.nameFa}` },
    { name: "description", content: "جزئیات فایل ملک و اطلاعات تماس با مشاور هیرمند در اصفهان." },
    { name: "robots", content: "index, follow" },
  ]}),
  component: PropertyDetailPage,
});
function money(value: string | null) { if (!value) return ""; const parsed = Number(value); return Number.isFinite(parsed) ? formatToman(parsed) : value; }
function PropertyDetailPage() {
  const property = Route.useLoaderData();
  if (!property) return <SiteChrome className="property-detail-shell"><section className="property-not-found"><MapPinned size={32} /><h1>این فایل دیگر در دسترس نیست</h1><p>ممکن است فایل فروخته، اجاره داده یا از حالت انتشار خارج شده باشد.</p><Link to="/" hash="listings" className="btn-gold">مشاهده فایل‌های فعال</Link></section></SiteChrome>;
  const images = property.images.length ? property.images : ["/images/type-apartment.jpg"];
  const price = property.transactionType === "rent" ? `رهن ${money(property.deposit) || "—"} تومان${property.rent ? ` • اجاره ${money(property.rent)} تومان` : ""}` : property.transactionType === "mortgage" ? `رهن ${money(property.deposit) || "—"} تومان` : property.price ? `${money(property.price)} تومان` : "تماس برای قیمت";
  return <SiteChrome className="property-detail-shell"><article className="property-detail">
    <div className="property-detail-top"><Link to="/" hash="listings" className="back-link"><ArrowRight size={17} /> بازگشت به فایل‌ها</Link><span className="property-detail-code">کد فایل: {property.slug.slice(-8).toUpperCase()}</span></div>
    <div className="property-gallery"><div className="property-gallery-main"><img src={images[0]} alt={property.title} fetchPriority="high" />{property.featured ? <span className="property-gallery-featured">فایل ویژه</span> : null}</div>{images.slice(1, 5).map((src) => <div key={src} className="property-gallery-thumb"><img src={src} alt="" loading="lazy" /></div>)}</div>
    <div className="property-detail-grid"><div className="property-detail-main"><div className="property-card-meta"><span>{property.neighborhood}</span><span>{property.city}</span></div><h1>{property.title}</h1><p className="property-detail-description">{property.description}</p>
      <div className="property-spec-grid">
        {property.areaM2 ? <div><Ruler size={18} /><span><small>متراژ</small><strong>{property.areaM2.toLocaleString("fa-IR")} متر</strong></span></div> : null}
        {property.bedrooms ? <div><BedDouble size={18} /><span><small>خواب</small><strong>{property.bedrooms.toLocaleString("fa-IR")}</strong></span></div> : null}
        {property.parking ? <div><CarFront size={18} /><span><small>پارکینگ</small><strong>دارد</strong></span></div> : null}
        {property.elevator ? <div><Elevator size={18} /><span><small>آسانسور</small><strong>دارد</strong></span></div> : null}
        {property.storage ? <div><Warehouse size={18} /><span><small>انباری</small><strong>دارد</strong></span></div> : null}
        {property.totalFloors ? <div><Building2 size={18} /><span><small>طبقه</small><strong>{property.floor ?? "—"} از {property.totalFloors}</strong></span></div> : null}
      </div>
      {property.features.length ? <div className="property-features"><h2>ویژگی‌های ملک</h2><div>{property.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</div></div> : null}
      {property.address ? <div className="property-address"><MapPinned size={20} /><div><strong>موقعیت</strong><p>{property.address} — {property.neighborhood}، اصفهان</p><a href={SITE.mapUrl} target="_blank" rel="noopener noreferrer">باز کردن نقشه دفتر</a></div></div> : null}
    </div><aside className="property-detail-side"><div className="property-price-box"><span>قیمت / شرایط</span><strong>{price}</strong></div><div className="property-contact-box"><span className="kicker">تماس مستقیم</span><h2>{property.contactName}</h2><p>{property.contactPhone}</p><a href={`tel:${property.contactPhone}`} className="btn-gold"><Phone size={17} /> تماس با مشاور</a><a href={`https://wa.me/${property.contactPhone.replace(/^0/, "98")}?text=${encodeURIComponent(`سلام، درباره فایل «${property.title}» از سایت هیرمند پیام می‌دهم.`)}`} className="btn-ghost" target="_blank" rel="noopener noreferrer">واتساپ درباره این فایل</a></div><Link to="/" hash="inquiry" className="property-request-box"><strong>این فایل مناسب من است</strong><span>درخواست بازدید یا فایل مشابه</span></Link></aside></div>
  </article></SiteChrome>;
}
