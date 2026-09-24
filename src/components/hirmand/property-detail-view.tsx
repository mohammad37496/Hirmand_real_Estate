import { Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import {
  ArrowRight,
  Bath,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageCircle,
  Share2,
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
  X,
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
  return property.price ? money(property.price) + " تومان" : "تماس بگیرید";
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
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("98") ? digits : digits.startsWith("0") ? "98" + digits.slice(1) : digits;
  const text = encodeURIComponent(`سلام، درباره فایل «${title}» از سایت هیرمند پیام می‌دهم.`);
  return `https://wa.me/${intl}?text=${text}`;
}

async function shareCurrentProperty(property: Pick<Property, "id" | "slug" | "title">) {
  if (typeof window === "undefined") return;
  const url = new URL(propertyPath(property), window.location.origin).toString();
  const data = {
    title: property.title,
    text: `فایل «${property.title}» در هیرمند`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(data);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
    trackAnalyticsEvent("property_share", property.slug);
  } catch {
    // Native sharing may be cancelled by the visitor.
  }
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
  const [failed, setFailed] = useState(false);
  const current = candidates[Math.min(attempt, Math.max(0, candidates.length - 1))] ?? fallback;

  if (failed) {
    return (
      <span className="property-image-fallback" role="img" aria-label={alt}>
        <span>تصویر در دسترس نیست</span>
      </span>
    );
  }

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
        if (attempt < candidates.length - 1) {
          setAttempt((value) => Math.min(value + 1, candidates.length - 1));
        } else {
          setFailed(true);
        }
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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef(0);

  const fallback = "/images/type-apartment.jpg";
  const current = images[active] ?? images[0] ?? "";

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const goTo = useCallback(
    (next: number) => {
      if (!images.length) return;
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
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") goTo(activeRef.current - 1);
      if (event.key === "ArrowRight") goTo(activeRef.current + 1);
      if (event.key === "0") setZoomScale(1);
      if (event.key === "Tab") {
        const focusable = Array.from(
          lightboxRef.current?.querySelectorAll("button:not([disabled]), a[href], video[controls]") ?? [],
        ).filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement && element.offsetParent !== null,
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus({ preventScroll: true });
      lastFocusedRef.current = null;
    };
  }, [lightboxOpen, goTo, closeLightbox]);

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
    <div className="property-gallery-wrap" role="region" aria-label={"گالری تصاویر " + title}>
      <div className="property-gallery">
        <div className="property-gallery-main">
          {isVideoUrl(current) ? (
            <video src={current} controls playsInline preload="metadata" aria-label={title} />
          ) : (
            <ResilientImage
              src={current}
              fallback={fallback}
              alt={title + " - تصویر " + (active + 1).toLocaleString("fa-IR")}
              itemProp="image"
              loading="eager"
              fetchPriority="high"
            />
          )}

          <button
            type="button"
            className="property-gallery-open"
            onClick={() => {
              setZoomScale(1);
              setLightboxOpen(true);
            }}
            aria-label="باز کردن گالری تصاویر در اندازه بزرگ"
          >
            <span>
              <Maximize2 size={16} aria-hidden="true" />
              تمام‌صفحه
            </span>
          </button>

          <div className="property-gallery-overlays">
            {featured ? <span className="property-gallery-featured">فایل ویژه</span> : null}
            {images.length > 1 ? (
              <span className="property-gallery-counter" aria-live="polite">
                تصویر {(active + 1).toLocaleString("fa-IR")} از {images.length.toLocaleString("fa-IR")}
              </span>
            ) : null}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="property-gallery-nav property-gallery-prev"
                onClick={() => goTo(active - 1)}
                aria-label="تصویر قبلی"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="property-gallery-nav property-gallery-next"
                onClick={() => goTo(active + 1)}
                aria-label="تصویر بعدی"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <div className="property-gallery-rail" aria-label="انتخاب تصویر">
          {images.map((src, index) => (
            <button
              key={src + "-" + index}
              type="button"
              className={"property-gallery-thumb" + (index === active ? " is-active" : "")}
              onClick={() => goTo(index)}
              aria-label={"نمایش تصویر " + (index + 1).toLocaleString("fa-IR") + " از " + images.length.toLocaleString("fa-IR")}
              aria-current={index === active ? "true" : undefined}
            >
              {isVideoUrl(src) ? (
                <video src={src} muted playsInline preload="none" aria-hidden="true" />
              ) : (
                <ResilientImage src={src} fallback={fallback} alt="" loading="lazy" />
              )}
              <span className="property-gallery-thumb-number">
                {(index + 1).toLocaleString("fa-IR")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {lightboxOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={lightboxRef}
              className="property-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={"نمایش تصاویر " + title}
              tabIndex={-1}
              onClick={closeLightbox}
            >
              <button
                ref={closeButtonRef}
                type="button"
                className="property-lightbox-close"
                onClick={closeLightbox}
                aria-label="بستن نمایش تصاویر"
                title="بستن نمایش تصاویر (Esc)"
              >
                <X size={21} strokeWidth={2.4} aria-hidden="true" />
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
                <ChevronRight size={26} aria-hidden="true" />
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
                    className={"property-lightbox-media-button" + (zoomScale > 1.05 ? " is-zoomed" : "")}
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
                      alt={title + " - تصویر " + (active + 1).toLocaleString("fa-IR")}
                      loading="eager"
                    />
                  </button>
                )}
                <div className="property-lightbox-count" aria-live="polite">
                  تصویر {(active + 1).toLocaleString("fa-IR")} از {images.length.toLocaleString("fa-IR")}
                </div>
                {!isVideoUrl(current) ? (
                  <button
                    type="button"
                    className="property-lightbox-zoom-hint"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleZoom();
                    }}
                    aria-label={zoomScale > 1.05 ? "خروج از بزرگ‌نمایی" : "بزرگ‌نمایی تصویر"}
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
                <ChevronLeft size={26} aria-hidden="true" />
              </button>

              <div className="property-lightbox-strip" onClick={(event) => event.stopPropagation()}>
                {images.map((src, index) => (
                  <button
                    key={src + "-" + index}
                    type="button"
                    className={"property-lightbox-thumb" + (index === active ? " is-active" : "")}
                    onClick={() => setActive(index)}
                    aria-label={"تصویر " + (index + 1).toLocaleString("fa-IR")}
                    aria-current={index === active ? "true" : undefined}
                  >
                    {isVideoUrl(src) ? (
                      <video src={src} muted playsInline preload="metadata" aria-hidden="true" />
                    ) : (
                      <ResilientImage src={src} fallback={fallback} alt="" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ConsultantCard({ property }: { property: Property }) {
  const person = TEAM.find((item) => item.phone === property.contactPhone || item.name === property.contactName);
  const displayName = property.contactName || person?.name || "مشاور هیرمند";
  const role = person?.role ?? "مشاور املاک";
  const initial = displayName.replace(/^آقای\s+/, "").trim().slice(0, 1) || "ه";
  const whatsapp = person?.wa || whatsappLink(property.contactPhone, property.title);

  return (
    <aside className="property-contact-card" aria-label="اطلاعات مشاور فایل">
      <div className="property-consultant-main">
        <div className="property-consultant-avatar" aria-hidden="true">{initial}</div>
        <div className="property-consultant-copy">
          <span className="kicker">مشاور فایل</span>
          <strong className="property-contact-name">{displayName}</strong>
          <span className="property-consultant-role">{role}</span>
        </div>
        <div className="property-consultant-badge" aria-hidden="true">
          <Phone size={18} />
        </div>
      </div>

      <a href={`tel:${property.contactPhone}`} dir="ltr" className="property-contact-phone">
        <Phone size={16} aria-hidden="true" />
        <span>{property.contactPhone}</span>
      </a>

      <p className="property-contact-note">
        برای هماهنگی بازدید، دریافت اطلاعات تکمیلی و بررسی شرایط معامله با این مشاور در تماس باشید.
      </p>

      <div className="property-contact-actions">
        <a
          href={`tel:${property.contactPhone}`}
          className="btn-gold"
          onClick={() => trackAnalyticsEvent("call_click", property.slug)}
        >
          <Phone size={16} aria-hidden="true" />
          تماس مستقیم
        </a>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          onClick={() => trackAnalyticsEvent("whatsapp_click", property.slug)}
        >
          <MessageCircle size={16} aria-hidden="true" />
          واتساپ
        </a>
      </div>

      {person ? (
        <Link
          className="property-contact-profile"
          to="/consultants/$id"
          params={{ id: person.id }}
        >
          مشاهده پروفایل کامل مشاور
          <ChevronLeft size={15} aria-hidden="true" />
        </Link>
      ) : null}
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
                {property.builtYear != null ? <div><CalendarDays size={18} /><span><small>سال ساخت</small><strong>{property.builtYear.toLocaleString("fa-IR", { useGrouping: false })}</strong></span></div> : null}
                <div><CarFront size={18} /><span><small>پارکینگ</small><strong>{property.parking ? "دارد" : "ندارد"}</strong></span></div>
                <div><Navigation size={18} /><span><small>آسانسور</small><strong>{property.elevator ? "دارد" : "ندارد"}</strong></span></div>
                <div><Warehouse size={18} /><span><small>انباری</small><strong>{property.storage ? "دارد" : "ندارد"}</strong></span></div>
              </div>
            </section>

            <div className="property-detail-summary">
              <header className="property-detail-summary-head">
                <div className="property-detail-hero-row">
                  <div className="property-status-group">
                    <span className="property-status-badge">
                      {TX_LABEL[property.transactionType]}
                    </span>
                    <span className="property-type-badge">
                      {TYPE_LABEL[property.propertyType]}
                    </span>
                  </div>
                  <span className="property-file-code">
                    کد فایل {property.id.slice(-6).toLocaleUpperCase("fa-IR")}
                  </span>
                </div>

                {property.featured ? (
                  <div className="property-featured-note">فایل ویژه هیرمند</div>
                ) : null}

                <h1>{property.title}</h1>

                <p className="property-detail-meta">
                  <MapPinned size={17} aria-hidden="true" />
                  <span>
                    {property.neighborhood}
                    {property.address ? ` · ${property.address}` : ""}
                  </span>
                </p>

                <div className="property-price-block">
                  <span>قیمت فایل</span>
                  <strong dir="rtl" className="property-price-value">{primaryPrice(property)}</strong>
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

                <div className="property-primary-contact" aria-label="تماس سریع با مشاور">
                  <a
                    className="property-primary-contact-call"
                    href={`tel:${property.contactPhone}`}
                    onClick={() => trackAnalyticsEvent("call_click", property.slug)}
                  >
                    <Phone size={18} aria-hidden="true" />
                    <span>تماس سریع</span>
                  </a>
                  <a
                    className="property-primary-contact-whatsapp"
                    href={whatsappLink(property.contactPhone, property.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackAnalyticsEvent("whatsapp_click", property.slug)}
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>واتساپ</span>
                  </a>
                </div>

                <div className="property-tools-heading">
                  <span>ابزارهای فایل</span>
                  <span>ذخیره، اشتراک، چاپ و مقایسه</span>
                </div>
                <PropertyActions property={property} />
              </header>

              <ConsultantCard property={property} />
            </div>

            <section className="property-detail-body" aria-labelledby="property-description-title">
              <div className="property-section-heading">
                <div>
                  <span className="kicker">توضیحات فایل</span>
                  <h2 id="property-description-title">شرح کامل ملک</h2>
                </div>
                <span className="property-source-badge">متن اصلی آگهی</span>
              </div>

              <div className="property-description-meta" aria-label="زمان انتشار و به‌روزرسانی">
                {property.publishedAt ? (
                  <span>
                    <strong>انتشار</strong>
                    <time dateTime={property.publishedAt}>{formatAdDate(property.publishedAt)}</time>
                  </span>
                ) : null}
                {property.updatedAt ? (
                  <span>
                    <strong>آخرین به‌روزرسانی</strong>
                    <time dateTime={property.updatedAt}>{formatAdDate(property.updatedAt)}</time>
                  </span>
                ) : null}
              </div>

              <div className="property-description-copy">
                {property.description.split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {property.features.length ? (
                <div className="property-features">
                  <div className="property-section-subheading">
                    <h3>ویژگی‌ها و امکانات</h3>
                    <span>{property.features.length.toLocaleString("fa-IR")} مورد</span>
                  </div>
                  <ul>
                    {property.features.map((f) => (
                      <li key={f}>
                        <Check size={15} aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

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

            <section className="property-final-cta" aria-label="درخواست بازدید و اطلاعات بیشتر">
              <div>
                <span className="kicker">قدم بعدی</span>
                <h2>برای بازدید یا اطلاعات بیشتر با مشاور فایل در ارتباط باشید.</h2>
                <p>برای هماهنگی بازدید، دریافت توضیحات تکمیلی یا بررسی شرایط معامله تماس بگیرید.</p>
              </div>
              <div className="property-final-cta-actions">
                <a
                  href={`tel:${property.contactPhone}`}
                  onClick={() => trackAnalyticsEvent("call_click", property.slug)}
                  className="btn-gold"
                >
                  <Phone size={17} aria-hidden="true" />
                  تماس تلفنی
                </a>
                <a
                  href={whatsappLink(property.contactPhone, property.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAnalyticsEvent("whatsapp_click", property.slug)}
                  className="btn-ghost"
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  واتساپ
                </a>
              </div>
            </section>

            <Link
              to="/properties"
              className="text-link"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <ArrowRight size={16} /> بازگشت به فهرست فایل‌ها
            </Link>
          </article>
        </section>

        <div className="property-mobile-actions" role="group" aria-label="اقدام‌های سریع فایل">
          <a
            href={`tel:${property.contactPhone}`}
            className="property-mobile-action property-mobile-action-call"
            onClick={() => trackAnalyticsEvent("call_click", property.slug)}
          >
            <Phone size={18} aria-hidden="true" />
            <span>تماس</span>
          </a>
          <a
            href={whatsappLink(property.contactPhone, property.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="property-mobile-action"
            onClick={() => trackAnalyticsEvent("whatsapp_click", property.slug)}
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span>واتساپ</span>
          </a>
          <button
            type="button"
            className="property-mobile-action"
            onClick={() => void shareCurrentProperty(property)}
          >
            <Share2 size={18} aria-hidden="true" />
            <span>اشتراک</span>
          </button>
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