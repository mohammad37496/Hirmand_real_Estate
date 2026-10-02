import { useMemo, useState } from "react";
import { Bath, BedDouble, CarFront, DoorOpen, Ruler, Sofa, Sparkles, Utensils, Warehouse } from "lucide-react";
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
    {
      id: "living",
      label: "پذیرایی و نشیمن",
      detail: "فضای عمومی",
      kind: "living",
    },
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
    rooms.push({
      id: "parking",
      label: "پارکینگ",
      detail: "جای خودرو",
      kind: "parking",
    });
  }

  if (property.storage) {
    rooms.push({
      id: "storage",
      label: "انباری",
      detail: "فضای ذخیره",
      kind: "storage",
    });
  }

  return rooms;
}

export function PropertyFloorPlan({ property }: { property: Property }) {
  const rooms = useMemo(() => buildRooms(property), [property]);
  const [activeId, setActiveId] = useState(rooms[0]?.id ?? "");
  const activeRoom = rooms.find((room) => room.id === activeId) ?? rooms[0] ?? null;

  return (
    <section id="property-floor-plan" className="property-new-feature property-floor-plan" aria-labelledby="property-floor-plan-title">
      <header className="property-new-feature-head">
        <div>
          <span className="kicker"><Sparkles size={14} /> نمای فضایی</span>
          <h2 id="property-floor-plan-title">پلان شماتیک و چیدمان فضاها</h2>
          <p>یک نمای تعاملی و تقریبی بر اساس مشخصات ثبت‌شده ملک؛ این تصویر جایگزین نقشه معماری یا پلان رسمی نیست.</p>
        </div>
        <span className="property-new-feature-badge">شماتیک خودکار</span>
      </header>

      <div className="property-floor-plan-meta">
        {property.areaM2 != null ? <span><Ruler size={14} /> {property.areaM2.toLocaleString("fa-IR")} متر</span> : null}
        {property.bedrooms != null ? <span><BedDouble size={14} /> {property.bedrooms.toLocaleString("fa-IR")} خواب</span> : null}
        {property.floor != null || property.floorLabel === "suite" ? (
          <span><DoorOpen size={14} /> {property.floorLabel === "suite" ? "سوئیت" : "طبقه " + (property.floor ?? 0).toLocaleString("fa-IR")}</span>
        ) : null}
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
    </section>
  );
}
