import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
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
import { breadcrumbJsonLd, propertyJsonLd, TX_LABEL, TYPE_LABEL } from "@/lib/seo";
import type { Property } from "@/lib/properties";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { PropertyActions } from "@/components/hirmand/property-actions";
import { formatToman } from "@/lib/money";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { isVideoUrl, mediaSourceCandidates } from "@/lib/media";
import { areaSlug } from "@/lib/areas";
import { propertyPath } from "@/lib/property-path";
import { TEAM } from "@/lib/site";
import { isFeaturedActive } from "@/lib/properties";

function money(value: string | null) {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatToman(parsed) : value;
}
function unitPrice(value: string | null, areaM2: number | null) {
  if (!value || !areaM2 || areaM2 <= 0) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return formatToman(Math.round(parsed / areaM2));
}
function primaryPrice(property: Property) {
  if (property.transactionType === "rent") {
    if (property.deposit) return "رهن " + money(property.deposit) + " تومان";
    if (property.rent) return "اجاره " + money(property.rent) + " تومان";
    return "تماس بگیرید";
  }
  if (property.transactionType === "mortgage") {
    return property.deposit ? "رهن " + money(property.deposit) + " تومان" : "تماس بگیرید";
  }
  return property.price ? "قیمت " + money(property.price) + " تومان" : "تماس بگیرید";
}

function mapsLink(latitude: number | null, longitude: number | null, neighborhood: string) {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`اصفهان ${neighborhood}`)}`;
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

function formatAdDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function ResilientImage({
  src,
  alt,
  fallback,
  className,
  loading,
  itemProp,
  fetchPriority,
}: {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
  loading?: "eager" | "lazy";
  itemProp?: string;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const candidates = mediaSourceCandidates(src, fallback);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[Math.min(attempt, candidates.length - 1)];

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      itemProp={itemProp}
      referrerPolicy="no-referrer"
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  const fallback = "/images/type-apartment.jpg";
  const current = images[active] ?? images[0] ?? "";

  const goTo = useCallback(
    (next: number) => {
      setActive((next + images.length) % images.length);
      setZoomScale(1);
    },
    [images.length],
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setZoomScale(1);
    touchStartX.current = null;
    pinchStartDistance.current = null;
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") goTo(active - 1);
      if (event.key === "ArrowRight") goTo(active + 1);
      if (event.key === "0") setZoomScale(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen, active, goTo, closeLightbox]);

  useEffect(() => {
    if (!images.length) return;

    const indexes = [
      (active + 1) % images.length,
      (active - 1 + images.length) % images.length,
    ];

    indexes.forEach((index) => {
      const src = images[index];
      if (!src || isVideoUrl(src)) return;
      const candidate = mediaSourceCandidates(src, fallback)[0];
      if (!candidate) return;
      const image = new Image();
      image.decoding = "async";
      image.src = candidate;
    });
  }, [active, images]);

  function touchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      pinchStartDistance.current = touchDistance(event.touches);
      pinchStartScale.current = zoomScale;
      touchStartX.current = null;
      return;
    }
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2 || pinchStartDistance.current == null) return;
    event.preventDefault();
    const distance = touchDistance(event.touches);
    if (!distance) return;
    const nextScale = pinchStartScale.current * (distance / pinchStartDistance.current);
    setZoomScale(Math.min(3, Math.max(1, nextScale)));
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (pinchStartDistance.current != null) {
      pinchStartDistance.current = null;
      if (zoomScale < 1.05) setZoomScale(1);
      return;
    }

    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX == null || zoomScale > 1.05 || images.length < 2) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 55) return;
    goTo(delta > 0 ? active - 1 : active + 1);
  }

  function toggleZoom() {
    setZoomScale((value) => (value > 1.05 ? 1 : 2.25));
  }

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
              fetchPriority="high"
            />
          )}
          {!isVideoUrl(current) ? (
            <button
              type="button"
              className="property-gallery-open"
              onClick={() => {
                setZoomScale(1);
                setLightboxOpen(true);
              }}
              aria-label="باز کردن تصویر در اندازه بزرگ"
            >
              مشاهده تمام‌صفحه
            </button>
          ) : null}
          {featured ? <span className="property-gallery-featured">فایل ویژه</span> : null}
          {images.length > 1 ? (
            <span className="property-gallery-counter">
              {(active + 1).toLocaleString("fa-IR")} / {images.length.toLocaleString("fa-IR")}
            </span>
          ) : null}
        </div>

        {images.slice(0, 4).map((src, index) => (
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

      {lightboxOpen ? (
        <div
          className="property-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="نمایش تصاویر فایل"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="property-lightbox-close"
            onClick={closeLightbox}
            aria-label="بستن"
          >
            ×
          </button>

          <button
            type="button"
            className="property-lightbox-nav property-lightbox-prev"
            onClick={(event) => {
              event.stopPropagation();
              goTo(active - 1);
            }}
            aria-label="تصویر قبلی"
          >
            ‹
          </button>

          <div
            className="property-lightbox-stage"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isVideoUrl(current) ? (
              <video src={current} controls playsInline autoPlay />
            ) : (
              <button
                type="button"
                className={`property-lightbox-media-button${zoomScale > 1.05 ? " is-zoomed" : ""}`}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  toggleZoom();
                }}
                onClick={(event) => event.stopPropagation()}
                aria-label={zoomScale > 1.05 ? "بازگرداندن اندازه تصویر" : "بزرگ‌نمایی تصویر"}
              >
                <ResilientImage
                  src={current}
                  fallback={fallback}
                  alt={title}
                  loading="eager"
                />
              </button>
            )}
            <div className="property-lightbox-count">
              {(active + 1).toLocaleString("fa-IR")} / {images.length.toLocaleString("fa-IR")}
            </div>
            {!isVideoUrl(current) ? (
              <button
                type="button"
                className="property-lightbox-zoom-hint"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleZoom();
                }}
                aria-label={zoomScale > 1.05 ? "خروج از بزرگ‌نمایی" : "بزرگ‌نمایی"}
              >
                {zoomScale > 1.05 ? "بازگشت به اندازه عادی" : "دو بار کلیک / لمس برای زوم"}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="property-lightbox-nav property-lightbox-next"
            onClick={(event) => {
              event.stopPropagation();
              goTo(active + 1);
            }}
            aria-label="تصویر بعدی"
          >
            ›
          </button>

          <div className="property-lightbox-strip" onClick={(event) => event.stopPropagation()}>
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                className={`property-lightbox-thumb${index === active ? " is-active" : ""}`}
                onClick={() => setActive(index)}
                aria-label={`تصویر ${(index + 1).toLocaleString("fa-IR")}`}
              >
                {isVideoUrl(src) ? (
                  <video src={src} muted playsInline preload="metadata" />
                ) : (
                  <ResilientImage src={src} fallback={fallback} alt="" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
function ConsultantCard({ property }: { property: Property }) {
  const person = TEAM.find((item) => item.phone === property.contactPhone || item.name === property.contactName);
  return (
    <aside className="property-contact-card">
      <div className="property-contact-heading">
        <div>
          <span className="kicker">تماس با مشاور</span>
          <h2>مشاور این فایل</h2>
        </div>
        <Phone size={18} />
      </div>
      <strong className="property-contact-name">{property.contactName}</strong>
      <a href={`tel:${property.contactPhone}`} dir="ltr" className="property-contact-phone">
        <Phone size={16} /> {property.contactPhone}
      </a>
      {person ? (
        <Link className="property-contact-profile" to="/consultants/$id" params={{ id: person.id }}>
          مشاهده پروفایل مشاور
        </Link>
      ) : null}
      <div className="property-contact-actions">
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
  );
}

export function PropertyDetailView({
  property,
  related,
}: {
  property: Property | null;
  related: Property[];
}) {
  const viewedPropertySlug = property?.slug;

  useEffect(() => {
    if (!viewedPropertySlug || typeof window === "undefined") return;
    const recentKey = "hirmand-recent-properties";
    try {
      const raw = localStorage.getItem(recentKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const recent = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item !== viewedPropertySlug)
        : [];
      localStorage.setItem(
        recentKey,
        JSON.stringify([viewedPropertySlug, ...recent].slice(0, 8)),
      );
    } catch {
      // History is a convenience feature; ignore storage failures.
    }
    const viewKey = `hirmand-viewed:${viewedPropertySlug}`;
    if (!sessionStorage.getItem(viewKey)) {
      trackAnalyticsEvent("property_view", viewedPropertySlug);
      sessionStorage.setItem(viewKey, "1");
    }
  }, [viewedPropertySlug]);

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
    { name: property.title, path: propertyPath(property) },
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

        <section className="property-detail-top" aria-label="خلاصه فایل">
          <div className="property-detail-top-gallery">
            <Gallery images={images} title={property.title} featured={isFeaturedActive(property)} />
          </div>

          <div className="property-detail-summary">
            <header className="property-detail-summary-head">
              <span className="kicker">
                {TX_LABEL[property.transactionType]} · {TYPE_LABEL[property.propertyType]}
              </span>
              <div className="property-detail-ad-meta">
                <span>کد آگهی {property.id.slice(-6).toUpperCase()}</span>
                {property.updatedAt ? <span>به‌روزرسانی {formatAdDate(property.updatedAt)}</span> : null}
              </div>
              <h1>{property.title}</h1>
              <p className="property-detail-meta">
                <MapPinned size={16} /> {property.neighborhood}
                {property.address ? ` · ${property.address}` : ""}
              </p>
              <div className="property-price-block">
                <span>قیمت فایل</span>
                <strong>{primaryPrice(property)}</strong>
                {property.price && property.areaM2 && (property.transactionType === "buy" || property.transactionType === "sell") ? (
                  <small className="property-price-per-m2">
                    قیمت تقریبی هر متر: <strong>{unitPrice(property.price, property.areaM2)} تومان</strong>
                  </small>
                ) : null}
                {property.deposit || property.rent ? (
                  <small>
                    {property.deposit ? `رهن ${money(property.deposit)}` : ""}
                    {property.deposit && property.rent ? " · " : ""}
                    {property.rent ? `اجاره ${money(property.rent)}` : ""}
                  </small>
                ) : null}
              </div>
              <PropertyActions property={property} />
            </header>

            <ConsultantCard property={property} />
          </div>
        </section>

        <section className="property-detail-content">
          <article className="property-detail-main">
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
        </section>

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