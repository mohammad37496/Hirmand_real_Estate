import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { isVideoUrl } from "@/lib/media";
import { getPublishedProperty } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { formatToman } from "@/lib/money";
import { propertyDetailHead } from "@/lib/seo";
import { areaPathFromNeighborhood } from "@/lib/areas";

export const Route = createFileRoute("/properties/$slug")({
  loader: async ({ params }) => {
    const property = await getPublishedProperty({ data: { slug: params.slug } });
    if (!property) throw notFound();
    return property;
  },
  head: ({ loaderData }) => (loaderData ? propertyDetailHead(loaderData) : {}),
  component: PropertyDetailPage,
});

function moneyLabel(raw: string | null) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? `${formatToman(n)} تومان` : raw;
}

function PropertyDetailPage() {
  const property = Route.useLoaderData();
  const images = property.images.length ? property.images : ["/images/type-apartment.jpg"];
  const areaPath = areaPathFromNeighborhood(property.neighborhood);
  const waText = encodeURIComponent(
    `سلام، درباره فایل «${property.title}» در ${SITE.nameFa} پیام می‌دهم.\n${SITE.url}/properties/${property.slug}`,
  );
  const waHref = `https://wa.me/${property.contactPhone.replace(/^0/, "98")}?text=${waText}`;

  return (
    <main className="property-detail-page">
      <nav className="property-breadcrumb" aria-label="مسیر">
        <Link to="/">خانه</Link>
        <span>/</span>
        {areaPath ? (
          <>
            <Link to="/areas/$slug" params={{ slug: areaPath }}>{property.neighborhood}</Link>
            <span>/</span>
          </>
        ) : null}
        <span>{property.title}</span>
      </nav>

      <div className="property-gallery">
        <div className="property-gallery-main">
          {isVideoUrl(images[0]) ? (
            <video src={images[0]} controls playsInline preload="metadata" />
          ) : (
            <img src={images[0]} alt={property.title} itemProp="image" fetchPriority="high" />
          )}
          {property.featured ? <span className="property-gallery-featured">فایل ویژه</span> : null}
        </div>
        {images.slice(1, 8).map((src) => (
          <div key={src} className="property-gallery-thumb">
            {isVideoUrl(src) ? (
              <video src={src} muted playsInline preload="metadata" />
            ) : (
              <img src={src} alt="" loading="lazy" />
            )}
          </div>
        ))}
      </div>

      <div className="property-detail-grid">
        <article className="property-detail-main">
          <header>
            <span className="kicker">{property.neighborhood} · اصفهان</span>
            <h1>{property.title}</h1>
            <p className="property-detail-price">
              {property.price ? moneyLabel(property.price) : null}
              {property.deposit ? ` · رهن ${moneyLabel(property.deposit)}` : ""}
              {property.rent ? ` · اجاره ${moneyLabel(property.rent)}` : ""}
            </p>
          </header>
          <div className="property-detail-specs">
            {property.areaM2 ? <span>{property.areaM2.toLocaleString("fa-IR")} متر</span> : null}
            {property.bedrooms != null ? <span>{property.bedrooms.toLocaleString("fa-IR")} خواب</span> : null}
            {property.bathrooms != null ? <span>{property.bathrooms.toLocaleString("fa-IR")} سرویس</span> : null}
            {property.floor != null ? <span>طبقه {property.floor.toLocaleString("fa-IR")}</span> : null}
            {property.parking ? <span>پارکینگ</span> : null}
            {property.elevator ? <span>آسانسور</span> : null}
            {property.storage ? <span>انباری</span> : null}
          </div>
          <div className="property-detail-body">
            <h2>توضیحات</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{property.description}</p>
            {property.features.length ? (
              <>
                <h2>ویژگی‌ها</h2>
                <ul>{property.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </>
            ) : null}
          </div>
        </article>
        <aside className="property-detail-aside">
          <div className="property-contact-card">
            <h2>مشاور این فایل</h2>
            <strong>{property.contactName}</strong>
            <a href={`tel:${property.contactPhone}`} dir="ltr">{property.contactPhone}</a>
            <a className="btn-gold" href={waHref} target="_blank" rel="noopener noreferrer">
              پیام در واتساپ
            </a>
            <a className="btn-ghost" href={`tel:${property.contactPhone}`}>تماس تلفنی</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
