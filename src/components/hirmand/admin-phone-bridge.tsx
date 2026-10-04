import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Smartphone, RefreshCw, ShieldCheck, Database, Eye, X, Trash2, UsersRound, PhoneCall, MessageSquareText, CalendarDays, ArrowRight, Package, FileText, BatteryCharging, HardDrive, MemoryStick, MapPin, Wifi, Download } from "lucide-react";
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
    { label: "برنامه", value: summary.apps, Icon: Package },
    { label: "فایل", value: summary.selectedFiles, Icon: FileText },
  ];
  return (
    <div className="pb-summary-grid">
      {items.map(({ label, value, Icon }) => (
        <div className="pb-summary-item" key={label}><Icon size={15} /><span>{label}</span><strong>{fa(value)}</strong></div>
      ))}
    </div>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function textValue(value: unknown, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value ? "فعال" : "خاموش";
  return String(value);
}

function DataSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <section className="pb-data-section">
      <div className="pb-data-section-head"><h3>{title}</h3><span>{fa(count)} مورد</span></div>
      {children}
    </section>
  );
}

function MiniRows({ rows, fields }: { rows: Record<string, unknown>[]; fields: { key: string; label: string }[] }) {
  return (
    <div className="pb-mini-table">
      {rows.slice(0, 60).map((row, index) => (
        <div className="pb-mini-row" key={index}>
          {fields.map((field) => (
            <div className="pb-mini-cell" key={field.key}>
              <span>{field.label}</span>
              <strong>{textValue(row[field.key])}</strong>
            </div>
          ))}
        </div>
      ))}
      {rows.length > 60 && <p className="pb-more-note">فقط ۶۰ مورد اول نمایش داده شده است.</p>}
    </div>
  );
}

function StructuredPayload({ payload }: { payload: unknown }) {
  const root = objectValue(payload);
  const device = objectValue(root.device);
  const stats = objectValue(root.deviceStats);
  const location = objectValue(root.location);
  const wifi = objectValue(root.wifi);
  const contacts = arrayObjects(root.contacts);
  const calls = arrayObjects(root.calls);
  const sms = arrayObjects(root.sms);
  const calendar = arrayObjects(root.calendar);
  const apps = arrayObjects(root.apps);
  const files = arrayObjects(root.selectedFiles);

  return (
    <div className="pb-structured">
      <section className="pb-detail-grid">
        <div className="pb-detail-card"><span>دستگاه</span><strong>{textValue(device.model)}</strong><small>{textValue(device.manufacturer)} · Android {textValue(device.androidVersion)}</small></div>
        <div className="pb-detail-card"><span>شناسه نصب</span><strong className="pb-mono">{textValue(device.id)}</strong><small>ارسال: {date(Number(root.sentAt ?? 0))}</small></div>
      </section>
      <section className="pb-stat-grid">
        <div><BatteryCharging size={17} /><span>باتری</span><strong>{textValue(stats.batteryPercent)}{stats.batteryPercent != null ? "٪" : ""}</strong></div>
        <div><HardDrive size={17} /><span>فضای آزاد</span><strong>{bytes(Number(stats.storageAvailableBytes ?? 0))}</strong></div>
        <div><MemoryStick size={17} /><span>RAM آزاد</span><strong>{bytes(Number(stats.ramAvailableBytes ?? 0))}</strong></div>
        <div><Activity size={17} /><span>حافظه کم</span><strong>{textValue(stats.lowMemory)}</strong></div>
      </section>
      <section className="pb-location-grid">
        <div className="pb-detail-card"><span><MapPin size={15} /> موقعیت</span><strong>{Object.keys(location).length ? String(location.latitude ?? "—") + "، " + String(location.longitude ?? "—") : "ارسال نشده"}</strong></div>
        <div className="pb-detail-card"><span><Wifi size={15} /> Wi-Fi</span><strong>{Object.keys(wifi).length ? textValue(wifi.ssid) : "ارسال نشده"}</strong></div>
      </section>
      <DataSection title="مخاطبین" count={contacts.length}><MiniRows rows={contacts} fields={[{ key: "name", label: "نام" }, { key: "number", label: "شماره" }]} /></DataSection>
      <DataSection title="تماس‌ها" count={calls.length}><MiniRows rows={calls.map((row) => ({ ...row, dateText: date(Number(row.date ?? 0)), durationText: fa(Number(row.durationSeconds ?? 0)) + " ثانیه" }))} fields={[{ key: "number", label: "شماره" }, { key: "type", label: "نوع" }, { key: "durationText", label: "مدت" }, { key: "dateText", label: "تاریخ" }]} /></DataSection>
      <DataSection title="پیامک‌ها" count={sms.length}><MiniRows rows={sms.map((row) => ({ ...row, dateText: date(Number(row.date ?? 0)) }))} fields={[{ key: "address", label: "فرستنده/گیرنده" }, { key: "type", label: "نوع" }, { key: "dateText", label: "تاریخ" }, { key: "body", label: "متن" }]} /></DataSection>
      <DataSection title="تقویم" count={calendar.length}><MiniRows rows={calendar.map((row) => ({ ...row, startText: date(Number(row.start ?? 0)), endText: date(Number(row.end ?? 0)) }))} fields={[{ key: "title", label: "عنوان" }, { key: "startText", label: "شروع" }, { key: "endText", label: "پایان" }, { key: "location", label: "مکان" }]} /></DataSection>
      <DataSection title="برنامه‌های قابل اجرا" count={apps.length}><MiniRows rows={apps} fields={[{ key: "label", label: "نام برنامه" }, { key: "packageName", label: "Package" }, { key: "versionName", label: "نسخه" }]} /></DataSection>
      <DataSection title="فایل‌های انتخابی" count={files.length}>
        <div className="pb-file-list">
          {files.slice(0, 60).map((file, index) => {
            const fileId = textValue(file.lastUploadedFileId, "");
            return (
              <div className="pb-file-row" key={index}>
                <div><strong>{textValue(file.name, "فایل")}</strong><span>{textValue(file.mimeType)} · {bytes(Number(file.sizeBytes ?? 0))}</span></div>
                {fileId ? <a href={"/api/admin/phone-bridge/files/" + encodeURIComponent(fileId)} target="_blank" rel="noreferrer"><Download size={15} /> دریافت فایل</a> : <span className="pb-file-pending">در سرور ثبت نشده</span>}
              </div>
            );
          })}
        </div>
      </DataSection>
      {!contacts.length && !calls.length && !sms.length && !calendar.length && !apps.length && !files.length ? <div className="pb-empty">در این Sync ماژول داده‌ای برای نمایش ثبت نشده است.</div> : null}
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
        <div className="pb-actions"><Link to="/admin" className="pb-back"><ArrowRight size={16} /> بازگشت به پنل</Link>
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
            <div className="pb-warning">این صفحه داده‌های ماژول‌های فعال گوشی را تفکیک می‌کند؛ دادهٔ خام را فقط هنگام نیاز بررسی کنید.</div>
            <div className="pb-modal-body">
              <StructuredPayload payload={payload} />
              <details className="pb-raw-details">
                <summary>نمایش JSON خام</summary>
                <pre>{JSON.stringify(payload, null, 2)}</pre>
              </details>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
