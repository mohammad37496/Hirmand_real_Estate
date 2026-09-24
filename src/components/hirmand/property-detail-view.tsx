import { Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import {
  ArrowRight,
  Accessibility,
  Armchair,
  Baby,
  Bath,
  BriefcaseBusiness,
  Camera,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  DoorOpen,
  Droplets,
  Dumbbell,
  ExternalLink,
  Flame,
  Flower2,
  Gauge,
  FastForward,
  Layers3,
  MapPinned,
  Home,
  KeyRound,
  Leaf,
  LockKeyhole,
  MonitorSmartphone,
  Navigation,
  PawPrint,
  Pause,
  Phone,
  Rewind,
  Ruler,
  ShieldCheck,
  Sofa,
  Sun,
  Trees,
  Utensils,
  Volume2,
  VolumeX,
  Warehouse,
  Waves,
  Wind,
  Wifi,
  Zap,
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
import {
  PROPERTY_CABINET_OPTIONS,
  PROPERTY_COOLING_OPTIONS,
  PROPERTY_FLOORING_OPTIONS,
  PROPERTY_HEATING_OPTIONS,
  PROPERTY_OTHER_AMENITY_OPTIONS,
  PROPERTY_WALL_CLOSET_OPTIONS,
  labelForOption,
} from "@/lib/property-options";

function propertyAmenityIcon(value: string) {
  switch (value) {
    case "balcony":
      return <Home size={18} aria-hidden="true" />;
    case "terrace":
      return <Armchair size={18} aria-hidden="true" />;
    case "roof_garden":
      return <Trees size={18} aria-hidden="true" />;
    case "yard":
      return <Flower2 size={18} aria-hidden="true" />;
    case "private_yard":
      return <Leaf size={18} aria-hidden="true" />;
    case "patio":
      return <DoorOpen size={18} aria-hidden="true" />;
    case "roof_access":
      return <KeyRound size={18} aria-hidden="true" />;
    case "master_bedroom":
      return <Sofa size={18} aria-hidden="true" />;
    case "walk_in_closet":
      return <Warehouse size={18} aria-hidden="true" />;
    case "guest_room":
      return <BedDouble size={18} aria-hidden="true" />;
    case "laundry":
      return <Droplets size={18} aria-hidden="true" />;
    case "maid_room":
      return <Home size={18} aria-hidden="true" />;
    case "storage_room":
      return <Warehouse size={18} aria-hidden="true" />;
    case "double_glazed":
      return <Layers3 size={18} aria-hidden="true" />;
    case "soundproof":
      return <VolumeX size={18} aria-hidden="true" />;
    case "thermal_insulation":
      return <Wind size={18} aria-hidden="true" />;
    case "security_door":
      return <LockKeyhole size={18} aria-hidden="true" />;
    case "video_intercom":
      return <MonitorSmartphone size={18} aria-hidden="true" />;
    case "smart_home":
      return <Wifi size={18} aria-hidden="true" />;
    case "central_vacuum":
      return <Wind size={18} aria-hidden="true" />;
    case "water_purifier":
      return <Droplets size={18} aria-hidden="true" />;
    case "water_tank":
      return <Droplets size={18} aria-hidden="true" />;
    case "pressure_pump":
      return <Gauge size={18} aria-hidden="true" />;
    case "generator":
      return <Zap size={18} aria-hidden="true" />;
    case "solar":
      return <Sun size={18} aria-hidden="true" />;
    case "fire_alarm":
      return <Flame size={18} aria-hidden="true" />;
    case "security_system":
      return <ShieldCheck size={18} aria-hidden="true" />;
    case "cctv":
      return <Camera size={18} aria-hidden="true" />;
    case "doorman":
      return <KeyRound size={18} aria-hidden="true" />;
    case "lobby":
      return <Building2 size={18} aria-hidden="true" />;
    case "gym":
      return <Dumbbell size={18} aria-hidden="true" />;
    case "pool":
      return <Waves size={18} aria-hidden="true" />;
    case "sauna":
      return <Flame size={18} aria-hidden="true" />;
    case "jacuzzi":
      return <Bath size={18} aria-hidden="true" />;
    case "sport_ground":
      return <Dumbbell size={18} aria-hidden="true" />;
    case "children_playground":
      return <Baby size={18} aria-hidden="true" />;
    case "coworking":
      return <BriefcaseBusiness size={18} aria-hidden="true" />;
    case "meeting_room":
      return <BriefcaseBusiness size={18} aria-hidden="true" />;
    case "commercial_permission":
      return <BriefcaseBusiness size={18} aria-hidden="true" />;
    case "separate_entrance":
      return <DoorOpen size={18} aria-hidden="true" />;
    case "reception":
      return <Sofa size={18} aria-hidden="true" />;
    case "open_kitchen":
      return <Utensils size={18} aria-hidden="true" />;
    case "island_kitchen":
      return <Utensils size={18} aria-hidden="true" />;
    case "dirty_kitchen":
      return <Utensils size={18} aria-hidden="true" />;
    case "roof_storage":
      return <Warehouse size={18} aria-hidden="true" />;
    case "private_park":
      return <CarFront size={18} aria-hidden="true" />;
    case "guest_park":
      return <CarFront size={18} aria-hidden="true" />;
    case "mechanized_park":
      return <CarFront size={18} aria-hidden="true" />;
    case "ev_charger":
      return <Zap size={18} aria-hidden="true" />;
    case "pet_friendly":
      return <PawPrint size={18} aria-hidden="true" />;
    case "wheelchair_access":
      return <Accessibility size={18} aria-hidden="true" />;
    case "elevator_private":
      return <Navigation size={18} aria-hidden="true" />;
    default:
      return <Sparkles size={18} aria-hidden="true" />;
  }
}

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

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "۰:۰۰";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toLocaleString("fa-IR")}:${seconds.toLocaleString("fa-IR", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })}`;
}

function VideoPlayer({
  src,
  title,
  autoPlay = false,
  className = "",
}: {
  src: string;
  title: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      setCurrentTime(video.currentTime || 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setPlaying(!video.paused && !video.ended);
      setMuted(video.muted);
    };

    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("ended", sync);
    video.addEventListener("volumechange", sync);

    sync();
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("ended", sync);
      video.removeEventListener("volumechange", sync);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) return;
    void video.play().catch(() => setPlaying(false));
  }, [autoPlay, src]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : duration;
    video.currentTime = Math.min(Math.max((video.currentTime || 0) + seconds, 0), max || Number.MAX_SAFE_INTEGER);
  }

  function seekTo(next: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(next)) return;
    video.currentTime = Math.min(Math.max(next, 0), duration || 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }

  return (
    <div
      className={`property-video-player ${className} ${playing ? "is-playing" : "is-paused"}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="property-video-frame">
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          aria-label={title}
          onDoubleClick={togglePlay}
        />
        <button
          type="button"
          className="property-video-center-play"
          onClick={togglePlay}
          aria-label={playing ? "توقف ویدیو" : "پخش ویدیو"}
          title={playing ? "توقف ویدیو" : "پخش ویدیو"}
        >
          {playing ? <Pause size={26} aria-hidden="true" /> : <Play size={26} fill="currentColor" aria-hidden="true" />}
        </button>
      </div>

      <div
        className="property-video-controls"
        dir="ltr"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={togglePlay} aria-label={playing ? "توقف ویدیو" : "پخش ویدیو"} title={playing ? "توقف" : "پخش"}>
          {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => seekBy(-10)} aria-label="۱۰ ثانیه عقب" title="۱۰ ثانیه عقب">
          <Rewind size={17} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => seekBy(10)} aria-label="۱۰ ثانیه جلو" title="۱۰ ثانیه جلو">
          <FastForward size={17} aria-hidden="true" />
        </button>
        <span className="property-video-time" aria-label="زمان ویدیو">
          {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
        </span>
        <input
          className="property-video-progress"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seekTo(Number(event.currentTarget.value))}
          aria-label="نوار زمان ویدیو"
          style={{ "--video-progress": duration ? `${(currentTime / duration) * 100}%` : "0%" } as Record<string, string>}
        />
        <button type="button" onClick={toggleMute} aria-label={muted ? "فعال کردن صدا" : "بی‌صدا کردن"} title={muted ? "فعال کردن صدا" : "بی‌صدا کردن"}>
          {muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
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
            <VideoPlayer src={current} title={title} className="is-gallery" />
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
                  <VideoPlayer src={current} title={title} autoPlay className="is-lightbox" />
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
                {property.cabinetType ? (
                  <div><Building2 size={18} /><span><small>نوع کابینت</small><strong>{labelForOption(PROPERTY_CABINET_OPTIONS, property.cabinetType)}</strong></span></div>
                ) : null}
                {property.flooringType ? (
                  <div><Layers3 size={18} /><span><small>کف</small><strong>{labelForOption(PROPERTY_FLOORING_OPTIONS, property.flooringType)}</strong></span></div>
                ) : null}
                {property.coolingSystem ? (
                  <div><Navigation size={18} /><span><small>سیستم سرمایش</small><strong>{labelForOption(PROPERTY_COOLING_OPTIONS, property.coolingSystem)}</strong></span></div>
                ) : null}
                {property.heatingSystem ? (
                  <div><Warehouse size={18} /><span><small>سیستم گرمایش</small><strong>{labelForOption(PROPERTY_HEATING_OPTIONS, property.heatingSystem)}</strong></span></div>
                ) : null}
                {property.wallClosetType ? (
                  <div><Building2 size={18} /><span><small>کمد دیواری</small><strong>{labelForOption(PROPERTY_WALL_CLOSET_OPTIONS, property.wallClosetType)}</strong></span></div>
                ) : null}
              </div>
              {property.otherAmenities.length ? (
                <details className="property-spec-amenities">
                  <summary>
                    <span className="property-spec-amenities-title">
                      <Sparkles size={18} aria-hidden="true" />
                      <span>
                        <small>امکانات تکمیلی</small>
                        <strong>امکانات دیگر</strong>
                      </span>
                    </span>
                    <span className="property-spec-amenities-toggle">
                      <small>{property.otherAmenities.length.toLocaleString("fa-IR")} مورد</small>
                      <ChevronDown size={19} aria-hidden="true" />
                    </span>
                  </summary>
                  <div className="property-spec-amenities-body">
                    {property.otherAmenities.map((value) => (
                      <div className="property-spec-amenity-item" key={value}>
                        {propertyAmenityIcon(value)}
                        <span>
                          <small>امکانات</small>
                          <strong>{labelForOption(PROPERTY_OTHER_AMENITY_OPTIONS, value)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
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