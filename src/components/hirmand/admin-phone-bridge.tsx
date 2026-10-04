import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Smartphone, RefreshCw, ShieldCheck, Database, Eye, X, Trash2, Wifi, MapPin, UsersRound, PhoneCall, MessageSquareText, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  getPhoneBridgeOverview,
  getPhoneBridgeSync,
  listPhoneBridgeDevices,
  listPhoneBridgeSyncs,
  purgePhoneBridgeData,
  type PhoneBridgeDevice,
} from "@/lib/admin-phone-bridge";

function fa(value: number) {
  return value.toLocaleString("fa-IR");
}

function bytes(value: number) {
  if (!value) return "۰ بایت";
  if (value < 1024) return fa(value) + " بایت";
  if (value < 1024 * 1024) return (value / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " KB";
  return (value / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " MB";
}

function date(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fa-IR");
}

function Summary({ summary }: { summary: PhoneBridgeDevice["summary"] }) {
  const items = [
    { label: "مخاطب", value: summary.contacts, Icon: UsersRound },
    { label: "تماس", value: summary.calls, Icon: PhoneCall },
    { label: "پیامک", value: summary.sms, Icon: MessageSquareText },
    { label: "تقویم", value: summary.calendar, Icon: CalendarDays },
  ];
  return (
    <div className="pb-summary-grid">
      {items.map(({ label, value, Icon }) => (
        <div className="pb-summary-item" key={label}><Icon size={15} /><span>{label}</span><strong>{fa(value)}</strong></div>
      ))}
    </div>
  );
}

export function AdminPhoneBridge() {
  const [devices, setDevices] = useState<PhoneBridgeDevice[]>([]);
  const [syncs, setSyncs] = useState<any[]>([]);
  const [overview, setOverview] = useState<{ devices: number; syncs: number; lastReceivedAt: string | null } | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [selectedSync, setSelectedSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [o,d,s] = await Promise.all([
        getPhoneBridgeOverview({ data: {} }),
        listPhoneBridgeDevices({ data: { limit: 100 } }),
        listPhoneBridgeSyncs({ data: { limit: 50 } }),
      ]);
      setOverview(o); setDevices(d); setSyncs(s);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت داده‌های Phone Bridge انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openSync(id: string) {
    try {
      const result = await getPhoneBridgeSync({ data: { syncId: id } });
      setSelectedSync(id);
      setPayload(result?.payload ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "نمایش بستهٔ دریافتی انجام نشد.");
    }
  }

  async function purge() {
    const raw = window.prompt("داده‌های قدیمی‌تر از چند روز پاک شوند؟", "30");
    if (raw == null) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast.error("عدد روز معتبر نیست.");
      return;
    }
    if (!window.confirm(`همهٔ بسته‌های قدیمی‌تر از ${fa(days)} روز حذف شوند؟`)) return;
    try {
      const result = await purgePhoneBridgeData({ data: { olderThanDays: days } });
      toast.success(`${fa(result.deleted)} بسته حذف شد.`);
      setSelectedSync(null); setPayload(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پاک‌سازی انجام نشد.");
    }
  }

  const selectedDevice = useMemo(() => {
    const id = syncs.find((s) => s.id === selectedSync)?.deviceId;
    return devices.find((d) => d.id === id);
  }, [devices, syncs, selectedSync]);

  return (
    <main className="pb-page" dir="rtl">
      <header className="pb-hero">
        <div className="pb-hero-icon"><Smartphone size={26} /></div>
        <div className="pb-hero-copy">
          <span>Phone Bridge · مدیریت اتصال</span>
          <h1>گوشی‌ها و همگام‌سازی داخلی</h1>
          <p>داده فقط با کلید اختصاصی دستگاه و از طریق مسیر Sync ثبت می‌شود؛ پنل عمومی به این اطلاعات دسترسی ندارد.</p>
        </div>
        <div className="pb-actions">
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={16} className={busy ? "pb-spin" : ""} /> بروزرسانی</button>
          <button type="button" className="pb-danger" onClick={() => void purge()} disabled={busy}><Trash2 size={16} /> پاک‌سازی قدیمی‌ها</button>
        </div>
      </header>

      <section className="pb-kpis">
        <div><span>دستگاه ثبت‌شده</span><strong>{fa(overview?.devices ?? 0)}</strong></div>
        <div><span>بسته‌های دریافت‌شده</span><strong>{fa(overview?.syncs ?? 0)}</strong></div>
        <div><span>آخرین دریافت</span><strong>{date(overview?.lastReceivedAt)}</strong></div>
        <div><span>وضعیت</span><strong className="pb-online"><Activity size={15} /> فعال</strong></div>
      </section>

      <section className="pb-card">
        <div className="pb-card-head"><div><span>دستگاه‌ها</span><h2>گوشی‌های متصل</h2></div><ShieldCheck size={18} /></div>
        {devices.length === 0 ? <div className="pb-empty">{busy ? "در حال دریافت…" : "هنوز دستگاهی Sync نکرده است."}</div> : (
          <div className="pb-device-list">
            {devices.map((device) => (
              <article className="pb-device" key={device.id}>
                <div className="pb-device-main">
                  <div className="pb-device-icon"><Smartphone size={19} /></div>
                  <div><strong>{device.name}</strong><span>{device.manufacturer} {device.model} · Android {device.androidVersion || "—"}</span><small>آخرین Sync: {date(device.lastSeenAt)}</small></div>
                </div>
                <Summary summary={device.summary} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pb-card">
        <div className="pb-card-head"><div><span>تاریخچه</span><h2>آخرین بسته‌های دریافتی</h2></div><Database size={18} /></div>
        {syncs.length === 0 ? <div className="pb-empty">هنوز داده‌ای دریافت نشده است.</div> : (
          <div className="pb-sync-list">
            {syncs.map((sync) => (
              <button className="pb-sync-row" type="button" key={sync.id} onClick={() => void openSync(sync.id)}>
                <div><strong>{sync.deviceName}</strong><span>{date(sync.receivedAt)} · {bytes(sync.payloadBytes)}</span></div>
                <Summary summary={sync.summary} />
                <Eye size={16} />
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedSync && (
        <div className="pb-modal-backdrop" onClick={() => { setSelectedSync(null); setPayload(null); }}>
          <section className="pb-modal" role="dialog" aria-modal="true" aria-label="دادهٔ بستهٔ انتخاب‌شده" onClick={(event) => event.stopPropagation()}>
            <header><div><span>بستهٔ دریافتی</span><h2>{selectedDevice?.name ?? "گوشی"}</h2></div><button type="button" onClick={() => { setSelectedSync(null); setPayload(null); }}><X size={18} /></button></header>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </section>
        </div>
      )}
    </main>
  );
}
