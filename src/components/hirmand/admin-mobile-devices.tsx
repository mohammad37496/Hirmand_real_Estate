import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Copy, Link2, RefreshCw, Smartphone, SmartphoneNfc } from "lucide-react";
import { toast } from "sonner";

type Device = {
  id: string; platform: string; appVersion: string; deviceModel: string; osVersion: string;
  label: string; enabled: boolean; firstSeenAt: string; lastSeenAt: string | null; eventCount: number;
};
type PairingResponse = { success?: boolean; pairingCode?: string; expiresMinutes?: number; expiresAt?: string; label?: string; statusMessage?: string };

function fa(value: number) { return value.toLocaleString("fa-IR"); }
function date(value: string | null) {
  return value ? new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "هنوز متصل نشده";
}

export function AdminMobileDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [label, setLabel] = useState("دستگاه دفتر");
  const [pairing, setPairing] = useState<PairingResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-mobile-devices", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list" }),
      });
      const data = (await response.json().catch(() => null)) as { devices?: Device[]; statusMessage?: string } | null;
      if (!response.ok) throw new Error(data?.statusMessage || "فهرست دستگاه‌ها دریافت نشد.");
      setDevices(data?.devices ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فهرست دستگاه‌ها دریافت نشد.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPairing() {
    setBusy("pairing");
    try {
      const response = await fetch("/api/admin-mobile-devices", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create_pairing", label }),
      });
      const data = (await response.json().catch(() => null)) as PairingResponse | null;
      if (!response.ok) throw new Error(data?.statusMessage || "کد جفت‌سازی ساخته نشد.");
      setPairing(data); toast.success("کد جفت‌سازی ساخته شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ساخت کد جفت‌سازی انجام نشد.");
    } finally { setBusy(""); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("کد جفت‌سازی کپی شد."); }
    catch { toast.error("کپی خودکار در دسترس نیست."); }
  }

  async function revoke(deviceId: string) {
    if (!window.confirm("دسترسی این دستگاه قطع شود؟")) return;
    setBusy(deviceId);
    try {
      const response = await fetch("/api/admin-mobile-devices", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", deviceId }),
      });
      const data = (await response.json().catch(() => null)) as { statusMessage?: string } | null;
      if (!response.ok) throw new Error(data?.statusMessage || "لغو دسترسی انجام نشد.");
      toast.success("دسترسی دستگاه قطع شد."); await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "لغو دسترسی انجام نشد.");
    } finally { setBusy(""); }
  }

  return (
    <div className="admin-mobile-devices" dir="rtl">
      <section className="admin-panel admin-mobile-pairing">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">اتصال داخلی</span>
            <h2><SmartphoneNfc size={19} /> جفت‌سازی دستگاه موبایل</h2>
            <p className="admin-dashboard-summary">یک کد یک‌بارمصرف بسازید و آن را فقط روی دستگاه مجاز وارد کنید. کد پیش‌فرض ۱۰ دقیقه اعتبار دارد و بعد از اولین ثبت باطل می‌شود.</p>
          </div>
          <Link2 size={18} />
        </div>
        <div className="admin-mobile-pairing-form">
          <label className="field"><span>عنوان دستگاه</span><input value={label} onChange={(event) => setLabel(event.target.value.slice(0, 120))} placeholder="مثلاً گوشی دفتر" /></label>
          <button type="button" className="btn-gold" onClick={() => void createPairing()} disabled={busy === "pairing"}><Smartphone size={15} /> {busy === "pairing" ? "در حال ساخت…" : "ساخت کد جفت‌سازی"}</button>
        </div>
        {pairing?.pairingCode ? (
          <div className="admin-mobile-pairing-result">
            <div><span>کد یک‌بارمصرف</span><strong dir="ltr">{pairing.pairingCode}</strong><small>اعتبار: {fa(pairing.expiresMinutes ?? 10)} دقیقه · عنوان: {pairing.label || label}</small></div>
            <button type="button" className="btn-ghost" onClick={() => void copy(pairing.pairingCode!)}><Copy size={15} /> کپی کد</button>
          </div>
        ) : null}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><span className="kicker">دستگاه‌های مجاز</span><h2><Smartphone size={19} /> فهرست دستگاه‌ها</h2></div>
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "admin-spin" : ""} /> بروزرسانی</button>
        </div>
        {loading ? <div className="admin-empty">در حال دریافت دستگاه‌ها…</div> : devices.length ? (
          <div className="admin-mobile-device-list">
            {devices.map((device) => (
              <article key={device.id} className={"admin-mobile-device-row" + (device.enabled ? "" : " is-revoked")}>
                <div className="admin-mobile-device-main">
                  <div className="admin-mobile-device-title"><strong>{device.label || device.deviceModel || device.id}</strong><span className={device.enabled ? "admin-device-status is-on" : "admin-device-status"}>{device.enabled ? "فعال" : "لغوشده"}</span></div>
                  <p>{device.deviceModel || "مدل نامشخص"} · Android {device.osVersion || "—"} · نسخه {device.appVersion || "—"}</p>
                  <small>شناسه: <bdi dir="ltr">{device.id}</bdi></small>
                  <small>آخرین ارتباط: {date(device.lastSeenAt)} · {fa(device.eventCount)} رویداد</small>
                </div>
                {device.enabled ? <button type="button" className="admin-icon-btn danger" title="لغو دسترسی" onClick={() => void revoke(device.id)} disabled={busy === device.id}><Ban size={15} /></button> : <CheckCircle2 size={18} aria-label="لغوشده" />}
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><Smartphone size={26} /><strong>هنوز دستگاهی جفت نشده است.</strong><span>کد بالا را بسازید و داخل اپ وارد کنید.</span></div>
        )}
      </section>
    </div>
  );
}
