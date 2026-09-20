import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  ExternalLink,
  Layers3,
  MapPinned,
  Navigation,
  Phone,
  Ruler,
  Warehouse,
} from "lucide-react";
import { getPublishedProperty, listRelatedProperties } from "@/lib/properties";
import {
  breadcrumbJsonLd,
  propertyHead,
  propertyJsonLd,
  TX_LABEL,
  TYPE_LABEL,
} from "@/lib/seo";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { PropertyActions } from "@/components/hirmand/property-actions";
import { formatToman } from "@/lib/money";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { isVideoUrl } from "@/lib/media";
import { areaSlug } from "@/lib/areas";

export const Route = createFileRoute("/properties/$slug")({
  loader: async ({ params }) => {
    const property = await getPublishedProperty({ data: { slug: params.slug } });
    if (!property) return { property: null, related: [] };

    const related = await listRelatedProperties({
      data: {
        slug: property.slug,
        neighborhood: property.neighborhood,
        propertyType: property.propertyType,
        limit: 6,
      },
    });

    return { property, related };
  },
  head: ({ loaderData, params }) =>
    propertyHead(loaderData?.property ?? null, params.slug),
  component: PropertyDetailPage,
});

function money(value: string | null) {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatToman(parsed) : value;
}

function mapsLink(latitude: number | null, longitude: number | null, neighborhood: string) {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`اصفهان ${neighborhood}`) }`;
}

function osmEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function whatsappLink(phone: string, title: string) {
  const intl = phone.replace(/^0/, "98");
  const text = encodeURIComponent(`سلام، درباره فایل «${title}» از سایت هیرمند پیام می‌دهم.`);
  return `https://wa.me/${intl}?text=${text}`;
}

function sourceCandidates(src: string, fallback: string) {
  const isExternal = /divarcdn\.com|wsrv\.nl/i.test(src);
  const proxy = isExternal
    ? `https://wsrv.nl/?url=${encodeURIComponent(src)}`
    : "";
  return Array.from(new Set([src, proxy, fallback].filter(Boolean)));
}

function ResilientImage({
  src,
  alt,
  fallback,
  className,
  loading,
  itemProp,
}: {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
  loading?: "eager" | "lazy";
  itemProp?: string;
}) {
  const candidates = sourceCandidates(src, fallback);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[Math.min(attempt, candidates.length - 1)];

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      itemProp={itemProp}
      decoding="async"
      onError={() => {
        setAttempt((value) => Math.min(value + 1, candidates.length - 1));
      }}
    />
  );
}

function Gallery({
  images,
  title,
  featured,
}: {
  images: string[];
  title: string;
  featured: boolean;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0] ?? "";
  const fallback = "/images/type-apartment.jpg";

  return (
    <div className="property-gallery-wrap">
      <div className="property-gallery">
        <div className="property-gallery-main">
          {isVideoUrl(current) ? (
            <video src={current} controls playsInline preload="metadata" />
          ) : (
            <ResilientImage
              src={current}
              fallback={fallback}
              alt={title}
              itemProp="image"
              loading="eager"
            />
          )}
          {featured ? (
            <span className="property-gallery-featured">فایل ویژه</span>
          ) : null}
          {images.length > 1 ? (
            <span className="property-gallery-counter">
              {(active + 1).toLocaleString("fa-IR")} / {images.length.toLocaleString("fa-IR")}
            </span>
          ) : null}
        </div>

        {images.slice(0, 9).map((src, index) => (
          <button
            key={src}
            type="button"
            className={`property-gallery-thumb${index === active ? " is-active" : ""}`}
            onClick={() => setActive(index)}
            aria-label={`نمایش تصویر ${(index + 1).toLocaleString("fa-IR")}`}
            aria-pressed={index === active}
          >
            {isVideoUrl(src) ? (
              <video src={src} muted playsInline preload="none" />
            ) : (
              <ResilientImage src={src} fallback={fallback} alt="" loading="lazy" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


function PropertyDetailPage() {
  const { property, related } = Route.useLoaderData();

  if (!property) {
    return (
      <SiteChrome>
        <main className="page-shell">
          <section className="empty-state">
            <h1>فایل پیدا نشد</h1>
            <p>این فایل منتشر نشده یا حذف شده است.</p>
            <Link to="/" className="btn-gold">بازگشت به خانه</Link>
          </section>
        </main>
      </SiteChrome>
    );
  }

  const images = property.images.length ? property.images : ["/images/type-apartment.jpg"];
  const area = areaSlug(property.neighborhood);
  const crumbs = [
    { name: "خانه", path: "/" },
    ...(area ? [{ name: property.neighborhood, path: `/areas/${area}` }] : []),
    { name: property.title, path: `/properties/${property.slug}` },
  ];

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertyJsonLd(property)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
      />
      <main className="property-detail-page">
        <nav className="property-breadcrumb" aria-label="مسیر">
          <Link to="/">خانه</Link>
          <span>/</span>
          {area ? (
            <>
              <Link to="/areas/$slug" params={{ slug: area }}>{property.neighborhood}</Link>
              <span>/</span>
            </>
          ) : null}
          <span>{property.title}</span>
        </nav>

        <Gallery
          images={images}
          title={property.title}
          featured={property.featured}
        />

        <div className="property-detail-grid">
          <article className="property-detail-main">
            <header>
              <span className="kicker">
                {TX_LABEL[property.transactionType]} · {TYPE_LABEL[property.propertyType]}
              </span>
              <h1>{property.title}</h1>
              <p className="property-detail-meta">
                <MapPinned size={16} /> {property.neighborhood}
                {property.address ? ` · ${property.address}` : ""}
              </p>
              <p className="property-detail-price">
                {property.price ? `${money(property.price)} تومان` : null}
                {property.deposit ? ` · رهن ${money(property.deposit)}` : ""}
                {property.rent ? ` · اجاره ${money(property.rent)}` : ""}
              </p>
              <PropertyActions property={property} />

            </header>

            <section className="property-divar-specs" aria-labelledby="property-specs-title">
              <div className="property-section-heading">
                <div>
                  <span className="kicker">جزئیات فایل</span>
                  <h2 id="property-specs-title">مشخصات ملک</h2>
                </div>
                <span className="property-source-badge">اطلاعات آگهی</span>
              </div>
              <div className="property-spec-grid">
                {property.areaM2 != null ? <div><Ruler size={18} /><span><small>متراژ</small><strong>{property.areaM2.toLocaleString("fa-IR")} متر</strong></span></div> : null}
                {property.bedrooms != null ? <div><BedDouble size={18} /><span><small>اتاق خواب</small><strong>{property.bedrooms.toLocaleString("fa-IR")}</strong></span></div> : null}
                {property.bathrooms != null ? <div><Bath size={18} /><span><small>سرویس</small><strong>{property.bathrooms.toLocaleString("fa-IR")}</strong></span></div> : null}
                {property.floor != null ? <div><Building2 size={18} /><span><small>طبقه</small><strong>{property.floor.toLocaleString("fa-IR")}</strong></span></div> : null}
                {property.totalFloors != null ? <div><Layers3 size={18} /><span><small>تعداد طبقات</small><strong>{property.totalFloors.toLocaleString("fa-IR")}</strong></span></div> : null}
                {property.builtYear != null ? <div><CalendarDays size={18} /><span><small>سال ساخت</small><strong>{property.builtYear.toLocaleString("fa-IR")}</strong></span></div> : null}
                <div><CarFront size={18} /><span><small>پارکینگ</small><strong>{property.parking ? "دارد" : "ندارد"}</strong></span></div>
                <div><Navigation size={18} /><span><small>آسانسور</small><strong>{property.elevator ? "دارد" : "ندارد"}</strong></span></div>
                <div><Warehouse size={18} /><span><small>انباری</small><strong>{property.storage ? "دارد" : "ندارد"}</strong></span></div>
              </div>
            </section>

            <div className="property-detail-body">
              <h2>توضیحات</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{property.description}</p>
              {property.features.length ? (
                <>
                  <h2>ویژگی‌ها</h2>
                  <ul>{property.features.map((f) => <li key={f}><Check size={14} /> {f}</li>)}</ul>
                </>
              ) : null}
            </div>

            {(property.latitude != null && property.longitude != null) || property.neighborhood ? (
              <section className="property-location-section" aria-labelledby="property-location-title">
                <div className="property-section-heading">
                  <div>
                    <span className="kicker">موقعیت</span>
                    <h2 id="property-location-title">موقعیت فایل روی نقشه</h2>
                  </div>
                  <MapPinned size={20} />
                </div>
                {property.latitude != null && property.longitude != null ? (
                  <div className="property-map-card">
                    <iframe
                      title={`موقعیت ${property.title}`}
                      src={osmEmbedUrl(property.latitude, property.longitude)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <div className="property-map-actions">
                      <span>اصفهان · {property.neighborhood}</span>
                      <a
                        href={mapsLink(property.latitude, property.longitude, property.neighborhood)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost"
                      >
                        <ExternalLink size={15} /> باز کردن در نقشه
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="property-location-fallback">
                    <MapPinned size={20} />
                    <div>
                      <strong>محدوده فایل</strong>
                      <p>اصفهان، {property.neighborhood}</p>
                    </div>
                    <a
                      href={mapsLink(null, null, property.neighborhood)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                    >
                      <ExternalLink size={15} /> جستجو در نقشه
                    </a>
                  </div>
                )}
              </section>
            ) : null}

            <Link
              to="/properties"
              className="text-link"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <ArrowRight size={16} /> بازگشت به فهرست فایل‌ها
            </Link>
          </article>

          <aside className="property-detail-aside">
            <div className="property-contact-card">
              <h2>مشاور این فایل</h2>
              <strong>{property.contactName}</strong>
              <a href={`tel:${property.contactPhone}`} dir="ltr" className="property-contact-phone">
                <Phone size={16} /> {property.contactPhone}
              </a>
              <a
                className="btn-gold"
                href={whatsappLink(property.contactPhone, property.title)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAnalyticsEvent("whatsapp_click", property.slug)}
              >
                پیام در واتساپ
              </a>
              <a
                className="btn-ghost"
                href={`tel:${property.contactPhone}`}
                onClick={() => trackAnalyticsEvent("call_click", property.slug)}
              >
                تماس تلفنی
              </a>
            </div>
          </aside>
        </div>

        {related.length ? (
          <section className="property-related" aria-labelledby="related-properties-title">
            <div className="section-head">
              <span className="kicker">پیشنهاد هیرمند</span>
              <h2 id="related-properties-title">فایل‌های مشابه</h2>
              <p>چند گزینه نزدیک به این فایل، بر اساس محله و نوع ملک.</p>
            </div>
            <div className="property-grid">
              {related.map((item) => (
                <PropertyCard key={item.id} property={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </SiteChrome>
  );
}
