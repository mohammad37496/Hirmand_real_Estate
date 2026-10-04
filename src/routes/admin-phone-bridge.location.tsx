import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, MapPin, RefreshCw, Navigation, Clock3, Signal, Satellite } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SITE } from "@/lib/site";
import {
  getPhoneBridgeLocationConfig,
  listPhoneBridgeDevices,
  listPhoneBridgeLocations,
  setPhoneBridgeLocationConfig,
  type PhoneBridgeDevice,
  type PhoneBridgeLocationPoint,
} from "@/lib/admin-phone-bridge";
import "@/admin-phone-bridge-location.css";

function fa(value: number) {
  return value.toLocaleString("fa-IR");
}
function date(value: string | number | null | undefined) {
  return value ? new Date(value).toLocaleString("fa-IR") : "—";
}
function accuracy(value: number | null) {
  return value == null ? "—" : fa(Math.round(value)) + " متر";
}

export function AdminPhoneBridgeLocation() {
  const [devices, setDevices] = useState<PhoneBridgeDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [config, setConfig] = useState<{ deviceId: string; enabled: boolean; intervalMinutes: 5 | 15 | 30 | 60 } | null>(null);
  const [points, setPoints] = useState<PhoneBridgeLocationPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const ds = await listPhoneBridgeDevices({ data: { limit: 100 } });
      setDevices(ds);
      const selected = deviceId || ds[0]?.id || "";
      if (selected && selected !== deviceId) setDeviceId(selected);
      if (selected) {
        const [cfg, history] = await Promise.all([
          getPhoneBridgeLocationConfig({ data: { deviceId: selected } }),
          listPhoneBridgeLocations({ data: { deviceId: selected, limit: 5000 } }),
        ]);
        setConfig(cfg);
        setPoints(history);
      } else {
        setConfig(null);
        setPoints([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت موقعیت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [deviceId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!deviceId) return;
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [deviceId, load]);

  const latest = points[0] ?? null;
  const mapUrl = latest
    ? "https://maps.google.com/maps?q=" + latest.latitude + "," + latest.longitude + "&z=16&output=embed"
    : "";
  const googleUrl = latest
    ? "https://www.google.com/maps/search/?api=1&query=" + latest.latitude + "," + latest.longitude
    : "";

  const changeConfig = async (patch: { enabled?: boolean; intervalMinutes?: 5 | 15 | 30 | 60 }) => {
    if (!config) return;
    setConfigBusy(true);
    try {
      const next = {
        deviceId: config.deviceId,
        enabled: patch.enabled ?? config.enabled,
        intervalMinutes: patch.intervalMinutes ?? config.intervalMinutes,
      };
      const result = await setPhoneBridgeLocationConfig({ data: next });
      if (result.success) {
        setConfig(result);
        toast.success(result.enabled ? "ردیابی موقعیت فعال شد." : "ردیابی موقعیت غیرفعال شد.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره تنظیمات موقعیت انجام نشد.");
    } finally {
      setConfigBusy(false);
    }
  };

  return (
    <main className="pbl-page" dir="rtl">
      <header className="pbl-header">
        <div>
          <span>Phone Bridge · موقعیت</span>
          <h1>ردیابی موقعیت GPS</h1>
          <p>تمام نقاط دریافتی دستگاه در سرور ثبت می‌شوند و آخرین نقطه روی نقشه Google نمایش داده می‌شود.</p>
        </div>
        <div className="pbl-actions">
          <Link to="/admin-phone-bridge"><ArrowRight size={16} /> Phone Bridge</Link>
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> بروزرسانی</button>
        </div>
      </header>

      <section className="pbl-card pbl-controls">
        <div className="pbl-control-grid">
          <label><span>دستگاه</span>
            <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} disabled={busy}>
              {devices.length === 0 ? <option value="">دستگاهی نیست</option> : null}
              {devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.model}</option>)}
            </select>
          </label>
          <label><span>بازهٔ دریافت</span>
            <select
              value={config?.intervalMinutes ?? 15}
              disabled={!config || configBusy}
              onChange={(event) => void changeConfig({ intervalMinutes: Number(event.target.value) as 5 | 15 | 30 | 60 })}
            >
              <option value={5}>هر ۵ دقیقه</option>
              <option value={15}>هر ۱۵ دقیقه</option>
              <option value={30}>هر ۳۰ دقیقه</option>
              <option value={60}>هر ۱ ساعت</option>
            </select>
          </label>
          <div className="pbl-toggle">
            <span>وضعیت ردیابی</span>
            <button
              type="button"
              className={config?.enabled ? "is-on" : ""}
              disabled={!config || configBusy}
              onClick={() => void changeConfig({ enabled: !config?.enabled })}
            >
              {config?.enabled ? "فعال" : "خاموش"}
            </button>
          </div>
          <div className="pbl-stat"><Satellite size={16} /><strong>{fa(points.length)}</strong><span>نقطه ثبت‌شده در این نمایش</span></div>
        </div>
        <div className="pbl-note">
          برای ردیابی واقعی، روی گوشی باید دسترسی موقعیت و گزینهٔ «ارسال دوره‌ای موقعیت GPS به پنل» قبلاً توسط صاحب دستگاه فعال شده باشد. تغییر بازه از این صفحه به گوشی منتقل می‌شود.
        </div>
      </section>

      <section className="pbl-grid">
        <article className="pbl-card pbl-map-card">
          <div className="pbl-card-head"><div><span>آخرین موقعیت</span><h2>نقشه Google</h2></div><Navigation size={18} /></div>
          {latest ? (
            <>
              <div className="pbl-location-summary">
                <div><strong>{latest.latitude.toFixed(6)}, {latest.longitude.toFixed(6)}</strong><span>مختصات GPS</span></div>
                <div><strong>{accuracy(latest.accuracyMeters)}</strong><span>دقت</span></div>
                <div><strong>{date(latest.recordedAt)}</strong><span>زمان ثبت</span></div>
              </div>
              <iframe
                className="pbl-map"
                title="آخرین موقعیت GPS"
                src={mapUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a className="pbl-google-link" href={googleUrl} target="_blank" rel="noreferrer">باز کردن همین نقطه در Google Maps</a>
            </>
          ) : <div className="pbl-empty">هنوز موقعیتی از این دستگاه دریافت نشده است.</div>}
        </article>

        <article className="pbl-card pbl-history-card">
          <div className="pbl-card-head"><div><span>تاریخچه</span><h2>تمام موقعیت‌های دریافتی</h2></div><Clock3 size={18} /></div>
          {points.length === 0 ? <div className="pbl-empty">تاریخچه‌ای وجود ندارد.</div> : (
            <div className="pbl-history-list">
              {points.map((point, index) => (
                <div className="pbl-history-row" key={point.id}>
                  <span className="pbl-index">{fa(index + 1)}</span>
                  <div>
                    <strong>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</strong>
                    <span>{date(point.recordedAt)} · دریافت: {date(point.receivedAt)}</span>
                    <small>دقت: {accuracy(point.accuracyMeters)} · منبع: {point.provider || "gps"}</small>
                  </div>
                  <a href={"https://www.google.com/maps/search/?api=1&query=" + point.latitude + "," + point.longitude} target="_blank" rel="noreferrer" aria-label="باز کردن نقطه در Google Maps"><MapPin size={15} /></a>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="pbl-card pbl-security">
        <div><Signal size={16} /><strong>امنیت و ثبت سوابق</strong></div>
        <p>ارسال نقاط با توکن اختصاصی دستگاه و امضای HMAC انجام می‌شود؛ هر نقطه با شناسهٔ یکتای دستگاه ثبت و از ثبت مجدد همان نقطه جلوگیری می‌شود.</p>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/admin-phone-bridge/location")({
  component: AdminPhoneBridgeLocation,
  head: () => ({
    meta: [
      { title: "ردیابی موقعیت Phone Bridge | " + SITE.nameFa },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
