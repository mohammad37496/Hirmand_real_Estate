import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, Smartphone, RefreshCw, ShieldCheck, Database, Eye, X, Trash2, UsersRound, PhoneCall, MessageSquareText, CalendarDays, ArrowRight, Package, FileText, BatteryCharging, HardDrive, MemoryStick, MapPin, Wifi, Download, Clock3, AlertTriangle, WifiOff, Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import "@/admin-phone-bridge-details.css";
import {
  getPhoneBridgeEventOverview,
  getPhoneBridgeOverview,
  getPhoneBridgeSync,
  acknowledgePhoneBridgeAlert,
  getPhoneBridgeAlerts,
  listPhoneBridgeDevices,
  listPhoneBridgeEvents,
  listPhoneBridgeHealthHistory,
  listPhoneBridgeSyncs,
  purgePhoneBridgeData,
  setPhoneBridgeDeviceEnabled,
  rotatePhoneBridgeDeviceToken,
  type PhoneBridgeAlert,
  type PhoneBridgeDevice,
  type PhoneBridgeHealthSample,
  type PhoneBridgeEvent,
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

function healthLabel(status: PhoneBridgeDevice["health"]["status"]) {
  return status === "online" ? "آنلاین" : status === "stale" ? "کم‌تحرک" : "آفلاین";
}

function age(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${fa(hours)} ساعت پیش`;
  return `${fa(Math.floor(hours / 24))} روز پیش`;
}

function storagePercent(device: PhoneBridgeDevice) {
  const free = device.health.storageAvailableBytes;
  const total = device.health.storageTotalBytes;
  if (!free || !total || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((free / total) * 100)));
}

function DeviceHealthStrip({ device }: { device: PhoneBridgeDevice }) {
  const storage = storagePercent(device);
  const lowBattery = device.health.batteryPercent != null && device.health.batteryPercent < 20 && device.health.batteryCharging !== true;
  const lowStorage = storage != null && storage < 10;
  const queued = device.health.queuedPackets;
  const deadLetters = device.health.deadLetterPackets;

  return (
    <div className="pb-health-strip">
      <span className={`pb-health-status is-${device.health.status}`}>
        {device.health.status === "offline" ? <WifiOff size={13} /> : device.health.status === "stale" ? <Clock3 size={13} /> : <Wifi size={13} />}
        {healthLabel(device.health.status)}
      </span>
      <span><BatteryCharging size={13} /> {device.health.batteryPercent == null ? "—" : `${fa(device.health.batteryPercent)}٪`}</span>
      <span><HardDrive size={13} /> {storage == null ? "—" : `${fa(storage)}٪ آزاد`}</span>
      <span><Clock3 size={13} /> {age(device.health.lastHeartbeatAt)}</span>
      {queued > 0 ? <span className={queued >= 20 ? "pb-health-warning" : ""}><Database size={13} /> {fa(queued)} در صف</span> : null}
      {deadLetters > 0 ? <span className="pb-health-warning"><AlertTriangle size={13} /> {fa(deadLetters)} خطای متوقف</span> : null}
      {lowBattery ? <span className="pb-health-warning"><AlertTriangle size={13} /> باتری کم</span> : null}
      {lowStorage ? <span className="pb-health-warning"><AlertTriangle size={13} /> فضای کم</span> : null}
    </div>
  );
}

function date(value: string | number | null | undefined) {
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
        <div className="pb-detail-card"><span>شناسه نصب</span><strong className="pb-mono">{textValue(device.id)}</strong><small>ارسال: {date(String(root.sentAt ?? ""))}</small></div>
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
  const [eventOverview, setEventOverview] = useState<{ total: number; last24h: number; errors24h: number; critical24h: number } | null>(null);
  const [events, setEvents] = useState<PhoneBridgeEvent[]>([]);
  const [alerts, setAlerts] = useState<PhoneBridgeAlert[]>([]);
  const [healthDeviceId, setHealthDeviceId] = useState<string>("");
  const [healthHistory, setHealthHistory] = useState<PhoneBridgeHealthSample[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [ackBusyId, setAckBusyId] = useState<string | null>(null);
  const seenAlertIds = useRef<Set<string>>(new Set());
  const [eventSeverity, setEventSeverity] = useState<"all" | "info" | "warning" | "error" | "critical">("all");
  const [payload, setPayload] = useState<unknown>(null);
  const [selectedSync, setSelectedSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [o,d,s,eo,al,es] = await Promise.all([
        getPhoneBridgeOverview({ data: {} }),
        listPhoneBridgeDevices({ data: { limit: 100 } }),
        listPhoneBridgeSyncs({ data: { limit: 50 } }),
        getPhoneBridgeEventOverview({ data: {} }),
        getPhoneBridgeAlerts({ data: { limit: 20 } }),
        listPhoneBridgeEvents({
          data: {
            limit: 80,
            ...(eventSeverity === "all" ? {} : { severity: eventSeverity }),
          },
        }),
      ]);
      setOverview(o); setDevices(d); setSyncs(s); setEventOverview(eo); setAlerts(al); setEvents(es);
      if (seenAlertIds.current.size > 0) {
        al.filter((item) => !seenAlertIds.current.has(item.id)).slice(0, 3).forEach((item) => {
          const text = item.title + " · " + item.deviceName;
          if (item.severity === "critical") toast.error(text);
          else if (item.severity === "error") toast.error(text);
          else toast.warning(text);
        });
      }
      seenAlertIds.current = new Set(al.map((item) => item.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت داده‌های Phone Bridge انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [eventSeverity]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function loadEvents(severity = eventSeverity) {
    try {
      const result = await listPhoneBridgeEvents({
        data: {
          limit: 80,
          ...(severity === "all" ? {} : { severity }),
        },
      });
      setEvents(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت مرکز خطا انجام نشد.");
    }
  }

  
  const loadHealthHistory = useCallback(async (deviceId: string) => {
    if (!deviceId) {
      setHealthHistory([]);
      return;
    }
    setHistoryBusy(true);
    try {
      const result = await listPhoneBridgeHealthHistory({ data: { deviceId, limit: 48 } });
      setHealthHistory(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت تاریخچه سلامت انجام نشد.");
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => {
    const first = healthDeviceId || devices[0]?.id || "";
    if (first && first !== healthDeviceId) setHealthDeviceId(first);
  }, [devices, healthDeviceId]);

  useEffect(() => {
    if (healthDeviceId) void loadHealthHistory(healthDeviceId);
  }, [healthDeviceId, loadHealthHistory]);

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
      toast.success(`${fa(result.deleted)} بسته و ${fa(result.filesDeleted ?? 0)} فایل قدیمی حذف شد.`);
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

      {(() => {
        const online = devices.filter((device) => device.health.status === "online").length;
        const stale = devices.filter((device) => device.health.status === "stale").length;
        const offline = devices.filter((device) => device.health.status === "offline").length;
        const lowBattery = devices.filter((device) =>
          device.health.batteryPercent != null &&
          device.health.batteryPercent < 20 &&
          device.health.batteryCharging !== true
        ).length;
        const lowStorage = devices.filter((device) => {
          const free = device.health.storageAvailableBytes;
          const total = device.health.storageTotalBytes;
          return !!free && !!total && free / total < 0.1;
        }).length;
        return (
          <section className="pb-health-card">
            <div className="pb-card-head">
              <div><span>مانیتورینگ</span><h2>سلامت دستگاه‌ها</h2></div>
              <Activity size={18} />
            </div>
            <div className="pb-health-overview">
              <div><strong>{fa(online)}</strong><span>آنلاین</span></div>
              <div><strong>{fa(stale)}</strong><span>نیازمند بررسی</span></div>
              <div><strong>{fa(offline)}</strong><span>آفلاین</span></div>
              <div><strong>{fa(lowBattery)}</strong><span>باتری کم</span></div>
              <div><strong>{fa(lowStorage)}</strong><span>فضای کم</span></div>
            </div>
            <div className="pb-health-note">
              وضعیت آنلاین یعنی آخرین Heartbeat در ۳۰ دقیقهٔ اخیر ثبت شده؛ بین ۳۰ دقیقه تا ۲۴ ساعت «نیازمند بررسی» و بعد از آن آفلاین در نظر گرفته می‌شود.
            </div>
          </section>
        );
      })()}


      <section className="pb-card pb-health-history-card">
        <div className="pb-card-head">
          <div><span>تحلیل روند</span><h2>تاریخچه سلامت دستگاه</h2></div>
          <Activity size={18} />
        </div>
        <div className="pb-history-toolbar">
          <label>
            <span>دستگاه</span>
            <select value={healthDeviceId} onChange={(event) => setHealthDeviceId(event.target.value)}>
              {devices.length === 0 ? <option value="">دستگاهی نیست</option> : null}
              {devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.model}</option>)}
            </select>
          </label>
          {historyBusy ? <span className="pb-history-loading">در حال دریافت تاریخچه…</span> : null}
        </div>
        {healthHistory.length === 0 ? (
          <div className="pb-empty">هنوز نمونه سلامت برای این دستگاه ثبت نشده است.</div>
        ) : (() => {
          const last = healthHistory[healthHistory.length - 1];
          const batterySamples = healthHistory.map((item) => item.batteryPercent).filter((value): value is number => value != null);
          const queueMax = Math.max(0, ...healthHistory.map((item) => item.queuedPackets));
          const deadMax = Math.max(0, ...healthHistory.map((item) => item.deadLetterPackets));
          const storage = last.storageAvailableBytes != null && last.storageTotalBytes != null && last.storageTotalBytes > 0
            ? Math.round((last.storageAvailableBytes / last.storageTotalBytes) * 100)
            : null;
          const battery = batterySamples.length ? batterySamples[batterySamples.length - 1] : null;
          return (
            <div className="pb-history-body">
              <div className="pb-history-summary">
                <div><span>باتری فعلی</span><strong>{battery == null ? "—" : `${fa(battery)}٪`}</strong></div>
                <div><span>فضای آزاد</span><strong>{storage == null ? "—" : `${fa(storage)}٪`}</strong></div>
                <div><span>صف فعلی</span><strong>{fa(last.queuedPackets)}</strong></div>
                <div><span>Dead-Letter</span><strong>{fa(last.deadLetterPackets)}</strong></div>
              </div>
              <div className="pb-history-chart">
                <div className="pb-history-chart-title">روند ۴۸ گزارش اخیر · باتری</div>
                <div className="pb-history-bars">
                  {healthHistory.map((item, index) => {
                    const value = item.batteryPercent ?? 0;
                    return (
                      <div className="pb-history-bar-wrap" title={date(item.recordedAt) + " · " + value + "٪"} key={item.recordedAt + index}>
                        <div className="pb-history-bar" style={{ height: Math.max(4, value) + "%" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pb-history-chart">
                <div className="pb-history-chart-title">روند صف ارسال</div>
                <div className="pb-history-bars is-queue">
                  {healthHistory.map((item, index) => {
                    const height = queueMax > 0 ? (item.queuedPackets / queueMax) * 100 : 4;
                    return (
                      <div className="pb-history-bar-wrap" title={date(item.recordedAt) + " · " + item.queuedPackets + " بسته"} key={"q-" + item.recordedAt + index}>
                        <div className="pb-history-bar" style={{ height: Math.max(4, height) + "%" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              {deadMax > 0 ? (
                <div className="pb-history-chart">
                  <div className="pb-history-chart-title">روند Dead-Letter</div>
                  <div className="pb-history-bars is-dead">
                    {healthHistory.map((item, index) => {
                      const height = (item.deadLetterPackets / deadMax) * 100;
                      return (
                        <div className="pb-history-bar-wrap" title={date(item.recordedAt) + " · " + item.deadLetterPackets + " خطا"} key={"d-" + item.recordedAt + index}>
                          <div className="pb-history-bar" style={{ height: Math.max(4, height) + "%" }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}
      </section>

      <section className="pb-card pb-alerts-card">
        <div className="pb-card-head">
          <div><span>مانیتورینگ خودکار</span><h2>هشدارهای فعال</h2></div>
          {alerts.length ? <BellRing size={18} /> : <Bell size={18} />}
        </div>
        {alerts.length === 0 ? (
          <div className="pb-no-alert"><ShieldCheck size={17} /> در حال حاضر هشدار مهمی برای دستگاه‌های فعال وجود ندارد.</div>
        ) : (
          <div className="pb-alert-list">
            {alerts.map((alert) => (
              <article className={`pb-alert-row severity-${alert.severity}`} key={alert.id}>
                <div className="pb-alert-icon">
                  {alert.severity === "critical" ? <AlertTriangle size={17} /> :
                    alert.severity === "error" ? <WifiOff size={17} /> : <BellRing size={17} />}
                </div>
                <div className="pb-alert-main">
                  <div className="pb-alert-title"><strong>{alert.title}</strong><span>{alert.deviceName}</span></div>
                  <p>{alert.message}</p>
                  <small>{date(alert.createdAt)}</small>
                  <button
                    type="button"
                    className="pb-alert-ack"
                    disabled={ackBusyId === alert.id}
                    onClick={async () => {
                      setAckBusyId(alert.id);
                      try {
                        const result = await acknowledgePhoneBridgeAlert({
                          data: { alertId: alert.id, deviceId: alert.deviceId ?? undefined },
                        });
                        if (result.success) {
                          toast.success("هشدار برای این مرحله تأیید شد و در Audit Log ثبت شد.");
                          await load();
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "تأیید هشدار انجام نشد.");
                      } finally {
                        setAckBusyId(null);
                      }
                    }}
                  >
                    {ackBusyId === alert.id ? "در حال ثبت…" : "تأیید بررسی"}
                  </button>
                </div>
                <span className="pb-alert-severity">{alert.severity === "critical" ? "بحرانی" : alert.severity === "error" ? "خطا" : "هشدار"}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pb-card pb-events-card">
        <div className="pb-card-head">
          <div><span>امنیت و عملیات</span><h2>مرکز خطا و Audit Log</h2></div>
          <ShieldCheck size={18} />
        </div>
        <div className="pb-event-kpis">
          <div><strong>{fa(eventOverview?.last24h ?? 0)}</strong><span>رویداد در ۲۴ ساعت</span></div>
          <div><strong>{fa(eventOverview?.errors24h ?? 0)}</strong><span>خطای ۲۴ ساعت</span></div>
          <div><strong>{fa(eventOverview?.critical24h ?? 0)}</strong><span>بحرانی</span></div>
          <div><strong>{fa(eventOverview?.total ?? 0)}</strong><span>کل رویدادها</span></div>
        </div>
        <div className="pb-event-toolbar">
          <label>
            <span>فیلتر شدت</span>
            <select
              value={eventSeverity}
              onChange={(event) => {
                const next = event.target.value as typeof eventSeverity;
                setEventSeverity(next);
                void loadEvents(next);
              }}
            >
              <option value="all">همه</option>
              <option value="info">اطلاعات</option>
              <option value="warning">هشدار</option>
              <option value="error">خطا</option>
              <option value="critical">بحرانی</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadEvents()}><RefreshCw size={14} /> بروزرسانی رویدادها</button>
        </div>
        {events.length === 0 ? (
          <div className="pb-empty">رویدادی برای نمایش وجود ندارد.</div>
        ) : (
          <div className="pb-event-list">
            {events.map((event) => (
              <article className={`pb-event-row severity-${event.severity}`} key={event.id}>
                <div className="pb-event-icon">
                  {event.severity === "critical" || event.severity === "error" ? <AlertTriangle size={16} /> :
                    event.severity === "warning" ? <Clock3 size={16} /> : <Activity size={16} />}
                </div>
                <div className="pb-event-main">
                  <div className="pb-event-title">
                    <strong>{event.message}</strong>
                    <span>{date(event.createdAt)}</span>
                  </div>
                  <p>{event.deviceName} · {event.eventType} · مدیر: {event.actorAccountId ?? "سیستم / نامشخص"}</p>
                </div>
                <span className="pb-event-severity">{event.severity}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pb-card">
        <div className="pb-card-head"><div><span>دستگاه‌ها</span><h2>گوشی‌های متصل</h2></div><ShieldCheck size={18} /></div>
        {devices.length === 0 ? <div className="pb-empty">{busy ? "در حال دریافت…" : "هنوز دستگاهی Sync نکرده است."}</div> : (
          <div className="pb-device-list">
            {devices.map((device) => (
              <article className="pb-device" key={device.id}>
                <div className="pb-device-main">
                  <div className="pb-device-icon"><Smartphone size={19} /></div>
                  <div>
                    <strong>{device.name}</strong>
                    <span>{device.manufacturer} {device.model} · Android {device.androidVersion || "—"}</span>
                    <small>آخرین Sync: {date(device.lastSeenAt)} · {device.tokenCreatedAt ? "توکن اختصاصی فعال" : "توکن اختصاصی هنوز ثبت نشده"}</small>
                  </div>
                </div>
                <Summary summary={device.summary} />
                <DeviceHealthStrip device={device} />
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                  <button type="button" onClick={async () => {
                    try {
                      const result = await setPhoneBridgeDeviceEnabled({ data: { deviceId: device.id, enabled: !device.enabled } });
                      if (result.success) { toast.success(result.enabled ? "دستگاه فعال شد." : "دستگاه غیرفعال شد."); await load(); }
                    } catch (error) { toast.error(error instanceof Error ? error.message : "تغییر وضعیت دستگاه انجام نشد."); }
                  }}>{device.enabled ? "غیرفعال کردن" : "فعال کردن"}</button>
                  <button type="button" onClick={async () => {
                    if (!window.confirm("توکن اختصاصی این دستگاه تعویض شود؟ توکن قبلی بلافاصله بی‌اعتبار می‌شود.")) return;
                    try {
                      const result = await rotatePhoneBridgeDeviceToken({ data: { deviceId: device.id } });
                      if (result.success && result.token) { setRevealedToken(result.token); toast.success("توکن جدید ساخته شد؛ فقط همین‌بار نمایش داده می‌شود."); await load(); }
                    } catch (error) { toast.error(error instanceof Error ? error.message : "تعویض توکن انجام نشد."); }
                  }}>تعویض توکن</button>
                </div>
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

      {revealedToken && (
        <div className="pb-modal-backdrop" onClick={() => setRevealedToken(null)}>
          <section className="pb-modal" role="dialog" aria-modal="true" aria-label="توکن جدید دستگاه" onClick={(event) => event.stopPropagation()}>
            <header><div><span>توکن جدید دستگاه</span><h2>فقط یک‌بار نمایش داده می‌شود</h2></div><button type="button" onClick={() => setRevealedToken(null)}><X size={18} /></button></header>
            <div className="pb-warning">این مقدار را در Phone Bridge ذخیره کن. بعد از بستن این پنجره، توکن از سرور دوباره قابل مشاهده نیست.</div>
            <div style={{padding:18}}>
              <code className="pb-mono" style={{display:"block",padding:12,wordBreak:"break-all"}}>{revealedToken}</code>
              <button type="button" style={{marginTop:10}} onClick={() => navigator.clipboard?.writeText(revealedToken).then(() => toast.success("توکن کپی شد."))}>کپی توکن</button>
            </div>
          </section>
        </div>
      )}
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
