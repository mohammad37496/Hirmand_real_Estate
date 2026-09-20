import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Building2,
  CarFront,
  Check,
  MapPinned,
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
import { isVideoUrl } from "@/lib/media";
import { areaSlug } from "@/lib/areas";
import { trackAnalyticsEvent } from "@/lib/analytics";

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

function whatsappLink(phone: string, title: string) {
  const intl = phone.replace(/^0/, "98");
  const text = encodeURIComponent(`سلام، درباره فایل «${title}» از سایت هیرمند پیام می‌دهم.`);
  return `https://wa.me/${intl}?text=${text}`;
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

  return (
    <div className="property-gallery-wrap">
      <div className="property-gallery">
        <div className="property-gallery-main">
          {isVideoUrl(current) ? (
            <video src={current} controls playsInline preload="metadata" />
          ) : (
            <img
              src={current}
              alt={title}
              itemProp="image"
              fetchPriority="high"
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

        {images.slice(0, 7).map((src, index) => (
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
              <img src={src} alt="" loading="lazy" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PropertyDetailPage() {
  const { property, related } = Route.useLoaderData();

  useEffect(() => {
    if (property) trackAnalyticsEvent("property_view", property.slug);
  }, [property]);

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

            <div className="property-detail-specs">
              {property.areaM2 != null ? (
                <span><Ruler size={16} /> {property.areaM2.toLocaleString("fa-IR")} متر</span>
              ) : null}
              {property.bedrooms != null ? (
                <span><BedDouble size={16} /> {property.bedrooms.toLocaleString("fa-IR")} خواب</span>
              ) : null}
              {property.floor != null ? (
                <span><Building2 size={16} /> طبقه {property.floor.toLocaleString("fa-IR")}</span>
              ) : null}
              {property.parking ? <span><CarFront size={16} /> پارکینگ</span> : null}
              {property.storage ? <span><Warehouse size={16} /> انباری</span> : null}
              {property.elevator ? <span><Check size={16} /> آسانسور</span> : null}
            </div>

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

            <Link to="/" className="text-link" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <ArrowRight size={16} /> بازگشت به فهرست
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
