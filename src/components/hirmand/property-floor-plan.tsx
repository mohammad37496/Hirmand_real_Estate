import { useEffect, useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  CarFront,
  DoorOpen,
  Expand,
  FileImage,
  Info,
  Maximize2,
  Ruler,
  RotateCcw,
  Sofa,
  Sparkles,
  Utensils,
  Warehouse,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Property } from "@/lib/properties";

type RoomKind = "living" | "kitchen" | "entrance" | "bedroom" | "bath" | "parking" | "storage";

type Room = {
  id: string;
  label: string;
  detail: string;
  kind: RoomKind;
};

function roomIcon(kind: RoomKind) {
  switch (kind) {
    case "living":
      return <Sofa size={18} aria-hidden="true" />;
    case "kitchen":
      return <Utensils size={18} aria-hidden="true" />;
    case "bedroom":
      return <BedDouble size={18} aria-hidden="true" />;
    case "bath":
      return <Bath size={18} aria-hidden="true" />;
    case "parking":
      return <CarFront size={18} aria-hidden="true" />;
    case "storage":
      return <Warehouse size={18} aria-hidden="true" />;
    default:
      return <DoorOpen size={18} aria-hidden="true" />;
  }
}

function buildRooms(property: Property): Room[] {
  const bedroomCount = Math.min(Math.max(property.bedrooms ?? 0, 0), 4);
  const bathroomCount = Math.min(Math.max(property.bathrooms ?? 0, 0), 2);
  const rooms: Room[] = [
    { id: "living", label: "پذیرایی و نشیمن", detail: "فضای عمومی", kind: "living" },
    {
      id: "kitchen",
      label: "آشپزخانه",
      detail: property.otherAmenities.includes("open_kitchen") ? "آشپزخانه اپن" : "فضای خدماتی",
      kind: "kitchen",
    },
    {
      id: "entrance",
      label: "ورودی",
      detail: property.floorLabel === "suite" ? "سوئیت" : "ورودی اصلی",
      kind: "entrance",
    },
  ];

  for (let index = 0; index < bedroomCount; index += 1) {
    rooms.push({
      id: "bedroom-" + (index + 1),
      label: "اتاق خواب " + (index + 1).toLocaleString("fa-IR"),
      detail: index === 0 ? "اتاق اصلی" : "اتاق خواب",
      kind: "bedroom",
    });
  }

  for (let index = 0; index < bathroomCount; index += 1) {
    rooms.push({
      id: "bath-" + (index + 1),
      label: "سرویس " + (index + 1).toLocaleString("fa-IR"),
      detail: "فضای بهداشتی",
      kind: "bath",
    });
  }

  if (property.parking) {
    rooms.push({ id: "parking", label: "پارکینگ", detail: "جای خودرو", kind: "parking" });
  }
  if (property.storage) {
    rooms.push({ id: "storage", label: "انباری", detail: "فضای ذخیره", kind: "storage" });
  }
  return rooms;
}

function isInternalMediaUrl(value: string) {
  return /^\/(?:api|uploads|media|images)\//i.test(value);
}

export function PropertyFloorPlan({ property }: { property: Property }) {
  const rooms = useMemo(() => buildRooms(property), [property]);
  const [activeId, setActiveId] = useState(rooms[0]?.id ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const activeRoom = rooms.find((room) => room.id === activeId) ?? null;
  const floorPlanUrl = property.floorPlanUrl?.trim() ?? "";
  const hasRealPlan = Boolean(floorPlanUrl);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  function openPlan() {
    setZoom(1);
    setLightboxOpen(true);
  }

  function changeZoom(delta: number) {
    setZoom((value) => Math.min(3, Math.max(1, Number((value + delta).toFixed(2)))));
  }

  return (
    <section
      id="property-floor-plan"
      className={"property-new-feature property-floor-plan" + (hasRealPlan ? " has-real-plan" : " is-schematic")}
      aria-labelledby="property-floor-plan-title"
    >
      <header className="property-new-feature-head">
        <div>
          <span className="kicker">
            {hasRealPlan ? <FileImage size={14} /> : <Sparkles size={14} />}
            {hasRealPlan ? "پلان ملک" : "نمای فضایی"}
          </span>
          <h2 id="property-floor-plan-title">{hasRealPlan ? "پلان و نقشه ملک" : "نمای شماتیک و چیدمان فضاها"}</h2>
          <p>
            {hasRealPlan
              ? "پلان واقعی ثبت‌شده برای این فایل. برای مشاهده در ابعاد بزرگ، روی تصویر کلیک کنید."
              : "نمای تعاملی و تقریبی بر اساس مشخصات ثبت‌شده ملک؛ این بخش جایگزین نقشه معماری یا پلان رسمی نیست."}
          </p>
        </div>
        <span className={"property-new-feature-badge" + (hasRealPlan ? " is-real" : "")}>
          {hasRealPlan ? "پلان واقعی" : "شماتیک خودکار"}
        </span>
      </header>

      <div className="property-floor-plan-meta">
        {property.areaM2 != null ? <span><Ruler size={14} /> {property.areaM2.toLocaleString("fa-IR")} متر</span> : null}
        {property.bedrooms != null ? <span><BedDouble size={14} /> {property.bedrooms.toLocaleString("fa-IR")} خواب</span> : null}
        {property.floor != null || property.floorLabel === "suite" ? (
          <span><DoorOpen size={14} /> {property.floorLabel === "suite" ? "سوئیت" : "طبقه " + (property.floor ?? 0).toLocaleString("fa-IR")}</span>
        ) : null}
      </div>

      {hasRealPlan ? (
        <div className="property-floor-plan-real">
          <button type="button" className="property-floor-plan-real-image-button" onClick={openPlan} aria-label="مشاهده پلان واقعی در اندازه بزرگ">
            <img
              src={floorPlanUrl}
              alt={"پلان واقعی " + property.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <span className="property-floor-plan-real-overlay">
              <Maximize2 size={18} />
              مشاهده تمام‌صفحه
            </span>
          </button>
          <div className="property-floor-plan-real-footer">
            <span><Info size={15} /> تصویر پلان توسط تیم هیرمند برای این فایل ثبت شده است.</span>
            <button type="button" className="btn-ghost" onClick={openPlan}>
              <Expand size={15} />
              بزرگ‌نمایی
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="property-floor-plan-notice">
            <Info size={15} />
            <span>پلان معماری این فایل ثبت نشده است؛ نمای زیر فقط برای درک سریع تقسیم فضاهاست.</span>
          </div>

          <div className="property-floor-plan-layout">
            <div className="property-floor-plan-canvas" aria-label="نمای شماتیک فضاهای ملک">
              {rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  className={"property-floor-room room-" + room.kind + (activeRoom?.id === room.id ? " is-active" : "")}
                  onClick={() => setActiveId(room.id)}
                  aria-pressed={activeRoom?.id === room.id}
                >
                  <span className="property-floor-room-icon">{roomIcon(room.kind)}</span>
                  <strong>{room.label}</strong>
                  <small>{room.detail}</small>
                </button>
              ))}
            </div>

            <aside className="property-floor-plan-panel" aria-live="polite">
              <span className="kicker">فضای انتخاب‌شده</span>
              {activeRoom ? (
                <>
                  <div className="property-floor-plan-selected-icon">{roomIcon(activeRoom.kind)}</div>
                  <h3>{activeRoom.label}</h3>
                  <p>{activeRoom.detail} · محل قرارگیری در این نمای شماتیک صرفاً برای درک سریع تقسیم فضاهاست.</p>
                </>
              ) : (
                <p>یکی از فضاها را انتخاب کنید.</p>
              )}
              <div className="property-floor-plan-legend">
                <span><i className="is-public" /> فضای عمومی</span>
                <span><i className="is-private" /> فضای خصوصی</span>
                <span><i className="is-service" /> خدماتی</span>
              </div>
            </aside>
          </div>
        </>
      )}

      {lightboxOpen && hasRealPlan ? (
        <div className="property-floor-plan-lightbox" role="dialog" aria-modal="true" aria-label="نمایش پلان واقعی" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="property-floor-plan-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="بستن پلان">
            <X size={20} />
          </button>
          <div className="property-floor-plan-lightbox-stage" onClick={(event) => event.stopPropagation()}>
            <img
              src={floorPlanUrl}
              alt={"پلان واقعی " + property.title}
              style={{ transform: "scale(" + zoom + ")" }}
            />
          </div>
          <div className="property-floor-plan-lightbox-controls" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1} aria-label="کوچک‌نمایی"><ZoomOut size={17} /></button>
            <span>{Math.round(zoom * 100).toLocaleString("fa-IR")}%</span>
            <button type="button" onClick={() => changeZoom(0.25)} disabled={zoom >= 3} aria-label="بزرگ‌نمایی"><ZoomIn size={17} /></button>
            <button type="button" onClick={() => setZoom(1)} aria-label="بازنشانی اندازه"><RotateCcw size={16} /></button>
          </div>
          <p className="property-floor-plan-lightbox-note">{isInternalMediaUrl(floorPlanUrl) ? "پلان واقعی ذخیره‌شده در سامانه هیرمند" : "پلان ثبت‌شده برای این فایل"}</p>
        </div>
      ) : null}
    </section>
  );
}
