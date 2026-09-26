import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LocateFixed, MapPinned, RotateCcw } from "lucide-react";
import { NEIGHBORHOOD_GROUPS, SITE } from "@/lib/site";

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

type AdminLocationPickerProps = Coordinates & {
  neighborhood: string;
  onChange: (coordinates: Coordinates) => void;
};

const LOCATION_PICKER_CSS = `
.admin-location{display:flex;flex-direction:column;gap:14px}
.admin-location-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.admin-location-title{display:flex;align-items:flex-start;gap:10px}
.admin-location-title>svg{margin-top:3px;color:var(--brass-700);flex:0 0 auto}
.admin-location-title strong{display:block;font-size:.95rem;color:var(--fg)}
.admin-location-title small{display:block;margin-top:4px;color:var(--muted);font-size:.78rem;line-height:1.8}
.admin-location-actions{display:flex;gap:8px;flex-wrap:wrap}
.admin-location-actions button,.admin-location-actions a{min-height:38px;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card-2);color:var(--fg);font:inherit;font-size:.78rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
.admin-location-actions button:hover,.admin-location-actions a:hover{border-color:var(--brass-300);background:var(--brass-100)}
.admin-location-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.admin-location-field{display:flex;flex-direction:column;gap:6px}
.admin-location-field>span{color:var(--muted);font-size:.78rem;font-weight:700}
.admin-location-field input{width:100%;min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg);outline:none;font:inherit;direction:ltr;text-align:left}
.admin-location-field input:focus{border-color:var(--brass-600);box-shadow:0 0 0 3px rgb(192 138 42 / 12%)}
.admin-location-status{margin:0;padding:10px 12px;border-radius:12px;background:var(--brass-100);color:var(--brass-800);font-size:.78rem;line-height:1.8}
.admin-location-map{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--paper-2);min-height:300px}
.admin-location-map iframe{display:block;width:100%;height:300px;border:0}
.admin-location-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;color:var(--subtle);font-size:.74rem;line-height:1.8}
.admin-location-foot strong{color:var(--fg)}
@media (max-width:600px){
  .admin-location-grid{grid-template-columns:1fr}
  .admin-location-map,.admin-location-map iframe{min-height:250px;height:250px}
}
`;

function toEnglishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function parseCoordinate(value: string, min: number, max: number) {
  const normalized = toEnglishDigits(value).trim().replace(/,/g, ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
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

export function AdminLocationPicker({
  latitude,
  longitude,
  neighborhood,
  onChange,
}: AdminLocationPickerProps) {
  const [latitudeText, setLatitudeText] = useState(latitude == null ? "" : String(latitude));
  const [longitudeText, setLongitudeText] = useState(longitude == null ? "" : String(longitude));

  useEffect(() => {
    setLatitudeText(latitude == null ? "" : String(latitude));
  }, [latitude]);

  useEffect(() => {
    setLongitudeText(longitude == null ? "" : String(longitude));
  }, [longitude]);

  const suggested = useMemo(() => {
    const normalized = neighborhood.trim();
    if (!normalized) return null;
    for (const group of NEIGHBORHOOD_GROUPS) {
      const found = group.items.find((item) => item.name === normalized);
      if (found) return found;
    }
    return null;
  }, [neighborhood]);

  const previewLatitude = latitude ?? suggested?.lat ?? SITE.lat;
  const previewLongitude = longitude ?? suggested?.lng ?? SITE.lng;
  const hasCustomLocation = latitude != null && longitude != null;

  function setCoordinate(key: "latitude" | "longitude", raw: string) {
    if (key === "latitude") {
      setLatitudeText(raw);
      const next = parseCoordinate(raw, -90, 90);
      onChange({ latitude: next, longitude });
      return;
    }

    setLongitudeText(raw);
    const next = parseCoordinate(raw, -180, 180);
    onChange({ latitude, longitude: next });
  }

  function useNeighborhoodCenter() {
    if (!suggested) return;
    setLatitudeText(String(suggested.lat));
    setLongitudeText(String(suggested.lng));
    onChange({ latitude: suggested.lat, longitude: suggested.lng });
  }

  function clearLocation() {
    setLatitudeText("");
    setLongitudeText("");
    onChange({ latitude: null, longitude: null });
  }

  return (
    <div className="admin-location">
      <style>{LOCATION_PICKER_CSS}</style>

      <div className="admin-location-head">
        <div className="admin-location-title">
          <MapPinned size={19} aria-hidden="true" />
          <div>
            <strong>موقعیت تقریبی روی نقشه</strong>
            <small>
              نقطه‌ای که اینجا ثبت می‌کنید برای نمایش محدوده فایل استفاده می‌شود؛
              <b> آدرس دقیق فقط داخل پنل مدیریت می‌ماند.</b>
            </small>
          </div>
        </div>

        <div className="admin-location-actions">
          {suggested ? (
            <button type="button" onClick={useNeighborhoodCenter}>
              <LocateFixed size={15} />
              مرکز محله
            </button>
          ) : null}
          <button type="button" onClick={clearLocation} disabled={!hasCustomLocation}>
            <RotateCcw size={15} />
            حذف موقعیت
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${previewLatitude},${previewLongitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            باز کردن نقشه
          </a>
        </div>
      </div>

      <div className="admin-location-grid">
        <label className="admin-location-field">
          <span>عرض جغرافیایی (Latitude)</span>
          <input
            inputMode="decimal"
            value={latitudeText}
            onChange={(event) => setCoordinate("latitude", event.target.value)}
            placeholder={suggested ? String(suggested.lat) : String(SITE.lat)}
            aria-label="عرض جغرافیایی موقعیت تقریبی"
          />
        </label>
        <label className="admin-location-field">
          <span>طول جغرافیایی (Longitude)</span>
          <input
            inputMode="decimal"
            value={longitudeText}
            onChange={(event) => setCoordinate("longitude", event.target.value)}
            placeholder={suggested ? String(suggested.lng) : String(SITE.lng)}
            aria-label="طول جغرافیایی موقعیت تقریبی"
          />
        </label>
      </div>

      <p className="admin-location-status">
        {hasCustomLocation
          ? "موقعیت اختصاصی فایل ثبت شده است. در سایت عمومی مختصات به‌صورت تقریبی نمایش داده می‌شود."
          : suggested
            ? `هنوز موقعیت اختصاصی ثبت نشده؛ نقشه فعلاً مرکز «${neighborhood}» را به‌عنوان پیش‌نمایش نشان می‌دهد.`
            : "هنوز موقعیت اختصاصی ثبت نشده؛ نقشه فعلاً مرکز اصفهان را به‌عنوان پیش‌نمایش نشان می‌دهد."}
      </p>

      <div className="admin-location-map">
        <iframe
          title={`پیش‌نمایش موقعیت تقریبی ${neighborhood || "فایل"}`}
          src={osmEmbedUrl(previewLatitude, previewLongitude)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="admin-location-foot">
        <span>
          <strong>نکته:</strong> برای حفظ حریم خصوصی، بهتر است نقطه را روی کوچه/ساختمان دقیق نگذاری؛
          یک محدوده نزدیک کافی است.
        </span>
        {hasCustomLocation ? <span dir="ltr">{latitude} · {longitude}</span> : null}
      </div>
    </div>
  );
}
