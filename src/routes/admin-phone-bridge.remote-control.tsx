import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  MapPin,
  MessageSquareText,
  Navigation,
  PhoneIncoming,
  Radio,
  RefreshCw,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPhoneBridgeRemoteCommand,
  getPhoneBridgeRemoteCommand,
  getPhoneBridgeRemoteDataPage,
  listPhoneBridgeRemoteCommands,
  type PhoneBridgeRemoteCommand,
  type RemoteDataType,
} from "@/lib/admin-phone-bridge-remote";
import { listPhoneBridgeDevices, type PhoneBridgeDevice } from "@/lib/admin-phone-bridge";
import "@/admin-phone-bridge-remote.css";

const DATA_COUNTS = [15, 30, 60, 100, 250, 500, 1000, 5000, 10000] as const;
const PAGE_SIZE = 50;

function fa(value: number) { return value.toLocaleString("fa-IR"); }
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString("fa-IR") : "—"; }
function epoch(value: unknown) { return typeof value === "number" ? new Date(value).toLocaleString("fa-IR") : "—"; }
function duration(value: unknown) {
  if (typeof value !== "number") return "—";
  const seconds = Math.max(0, Math.round(value));
  const m = Math.floor(seconds / 60);
  return m ? `${m} دقیقه و ${seconds % 60} ثانیه` : `${seconds} ثانیه`;
}
function typeLabel(type: RemoteDataType | null | undefined) {
  return type === "sms" ? "پیامک‌های دریافتی" : type === "incoming_calls" ? "تماس‌های دریافتی" : "داده";
}
function statusMeta(status: PhoneBridgeRemoteCommand["status"]) {
  if (status === "succeeded") return { text: "موفق", Icon: CheckCircle2 };
  if (status === "failed") return { text: "ناموفق", Icon: XCircle };
  if (status === "expired") return { text: "منقضی", Icon: XCircle };
  if (status === "running") return { text: "در حال اجرا", Icon: Radio };
  return { text: "در انتظار گوشی", Icon: Clock3 };
}

export function AdminPhoneBridgeRemoteControl() {
  const [devices, setDevices] = useState<PhoneBridgeDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [commands, setCommands] = useState<PhoneBridgeRemoteCommand[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedType, setSelectedType] = useState<RemoteDataType>("sms");
  const [selectedCount, setSelectedCount] = useState<number>(15);
  const [dataCommandId, setDataCommandId] = useState<string | null>(null);
  const [dataType, setDataType] = useState<RemoteDataType | null>(null);
  const [dataRows, setDataRows] = useState<Record<string, unknown>[]>([]);
  const [dataTotal, setDataTotal] = useState(0);
  const [dataPage, setDataPage] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const ds = await listPhoneBridgeDevices({ data: { limit: 100 } });
      setDevices(ds);
      const selected = deviceId || ds[0]?.id || "";
      if (selected && selected !== deviceId) setDeviceId(selected);
      if (selected) setCommands(await listPhoneBridgeRemoteCommands({ data: { deviceId: selected, limit: 20 } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت وضعیت ریموت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [deviceId]);

  useEffect(() => { void load(); }, [load]);

  const loadDataPage = useCallback(async (commandId: string, page: number) => {
    setDataLoading(true);
    try {
      const result = await getPhoneBridgeRemoteDataPage({ data: { commandId, page, pageSize: PAGE_SIZE } });
      setDataCommandId(commandId);
      setDataType(result.dataType);
      setDataTotal(result.totalCount);
      setDataPage(page);
      setDataRows(result.rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت نتیجهٔ دیتا انجام نشد.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  async function runLocation() {
    if (!deviceId) return;
    setBusy(true);
    setRunningId(null);
    try {
      const created = await createPhoneBridgeRemoteCommand({ data: { deviceId, action: "get_location" } });
      if (!created.success || !created.commandId) throw new Error("ثبت فرمان ریموت انجام نشد.");
      setRunningId(created.commandId);
      toast.success("فرمان گرفتن لوکیشن ثبت شد.");
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const result = await getPhoneBridgeRemoteCommand({ data: { commandId: created.commandId } });
        if (!result) break;
        setCommands((current) => [result, ...current.filter((item) => item.id !== result.id)].slice(0, 20));
        if (result.status === "succeeded") { toast.success("لوکیشن دریافت شد."); break; }
        if (result.status === "failed" || result.status === "expired") { toast.error(result.errorMessage || "دریافت لوکیشن ناموفق بود."); break; }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "اجرای فرمان ریموت انجام نشد.");
    } finally {
      setRunningId(null);
      setBusy(false);
      void load();
    }
  }

  async function runRestoreData() {
    if (!deviceId) return;
    setBusy(true);
    setRunningId(null);
    setDataCommandId(null);
    setDataRows([]);
    setDataType(null);
    setDataTotal(0);
    setDataPage(0);
    try {
      const created = await createPhoneBridgeRemoteCommand({
        data: { deviceId, action: "restore_data", dataType: selectedType, requestedCount: selectedCount },
      });
      if (!created.success || !created.commandId) throw new Error("ثبت درخواست بازگردانی انجام نشد.");
      setRunningId(created.commandId);
      toast.success("درخواست به گوشی فرستاده شد؛ تأیید روی گوشی لازم است.");

      for (let i = 0; i < 120; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const result = await getPhoneBridgeRemoteCommand({ data: { commandId: created.commandId } });
        if (!result) break;
        setCommands((current) => [result, ...current.filter((item) => item.id !== result.id)].slice(0, 20));
        if (result.status === "succeeded") {
          toast.success(`بازگردانی کامل شد: ${fa(result.result?.receivedCount ?? 0)} مورد.`);
          await loadDataPage(created.commandId, 0);
          break;
        }
        if (result.status === "failed" || result.status === "expired") {
          toast.error(result.errorMessage || "بازگردانی دیتا انجام نشد.");
          break;
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "اجرای بازگردانی انجام نشد.");
    } finally {
      setRunningId(null);
      setBusy(false);
      void load();
    }
  }

  const lastLocation = commands.find((item) => item.action === "get_location" && item.status === "succeeded" && item.result);
  const latestDataCommand = commands.find((item) => item.action === "restore_data" && item.status === "succeeded" && item.result);
  const activeData = dataCommandId && latestDataCommand?.id === dataCommandId ? latestDataCommand : null;
  const totalPages = Math.max(1, Math.ceil(dataTotal / PAGE_SIZE));

  return (
    <main className="pbr-page" dir="rtl">
      <header className="pbr-header">
        <div>
          <span>Phone Bridge · ریموت کنترل</span>
          <h1>کنترل ریموت دستگاه</h1>
          <p>برای داده‌های ارتباطی، درخواست پنل فقط پس از تأیید صریح روی همان گوشی اجرا می‌شود.</p>
        </div>
        <div className="pbr-actions">
          <Link to="/admin-phone-bridge"><ArrowRight size={16} /> Phone Bridge</Link>
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> بروزرسانی</button>
        </div>
      </header>

      <section className="pbr-card pbr-controls">
        <div className="pbr-control-grid">
          <label>
            <span>دستگاه</span>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={busy}>
              {!devices.length ? <option value="">دستگاهی نیست</option> : null}
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.model}</option>)}
            </select>
          </label>
          <div className="pbr-action-column">
            <span>اکشن سریع</span>
            <button type="button" className="pbr-primary" onClick={() => void runLocation()} disabled={!deviceId || busy}>
              <MapPin size={18} /> {runningId ? "در حال اجرا…" : "گرفتن لوکیشن"}
            </button>
          </div>
        </div>
        <div className="pbr-note"><Smartphone size={16} /><span>ریموت کنترل فعال باشد. برای بازگردانی دیتا، کلید مربوط به «پیامک‌ها» یا «تاریخچه تماس‌ها» در خود اپ باید روشن باشد و تأیید گوشی نیز لازم است.</span></div>
      </section>

      <section className="pbr-grid">
        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>اکشن</span><h2><Database size={19} /> بازگردانی دیتا</h2></div><Radio size={20} /></div>
          <div className="pbr-data-controls">
            <label>
              <span>نوع داده</span>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as RemoteDataType)} disabled={busy}>
                <option value="sms">آخرین پیامک‌های دریافتی</option>
                <option value="incoming_calls">آخرین تماس‌های دریافتی</option>
              </select>
            </label>
            <label>
              <span>تعداد</span>
              <select value={selectedCount} onChange={(e) => setSelectedCount(Number(e.target.value))} disabled={busy}>
                {DATA_COUNTS.map((count) => <option key={count} value={count}>{fa(count)} دادهٔ آخر</option>)}
              </select>
            </label>
            <button type="button" className="pbr-primary pbr-data-run" onClick={() => void runRestoreData()} disabled={!deviceId || busy}>
              <Database size={17} /> {runningId ? "در انتظار تأیید/دریافت…" : "دریافت اطلاعات"}
            </button>
          </div>
          <div className="pbr-action-row">
            <div><strong>{typeLabel(selectedType)}</strong><span>{fa(selectedCount)} مورد آخر · تأیید روی گوشی الزامی است</span></div>
            {selectedType === "sms" ? <MessageSquareText size={20} /> : <PhoneIncoming size={20} />}
          </div>
        </article>

        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>نتیجه</span><h2><Database size={19} /> نتیجهٔ بازگردانی</h2></div><span>{fa(dataTotal)} مورد</span></div>
          {!activeData ? (
            <div className="pbr-empty">هنوز نتیجهٔ موفقی برای بازگردانی دیتا ثبت نشده است.</div>
          ) : (
            <>
              <div className="pbr-location">
                <strong>{typeLabel(activeData.result?.dataType)} · {fa(activeData.result?.receivedCount ?? 0)} مورد</strong>
                <span>درخواست: {fa(activeData.result?.requestedCount ?? 0)} · قطعات: {fa(activeData.result?.chunkCount ?? 0)} · تکمیل: {date(activeData.completedAt)}</span>
              </div>
              <div className="pbr-data-table-wrap">
                <table className="pbr-data-table">
                  <thead>
                    {dataType === "sms"
                      ? <tr><th>ردیف</th><th>فرستنده</th><th>تاریخ</th><th>متن</th><th>خوانده</th></tr>
                      : <tr><th>ردیف</th><th>شماره</th><th>تاریخ</th><th>مدت</th><th>جدید</th></tr>}
                  </thead>
                  <tbody>
                    {dataRows.length ? dataRows.map((row, index) =>
                      dataType === "sms" ? (
                        <tr key={index}>
                          <td>{fa(dataPage * PAGE_SIZE + index + 1)}</td>
                          <td dir="ltr">{String(row.address ?? "—")}</td>
                          <td>{epoch(row.date)}</td>
                          <td className="pbr-sms-body">{String(row.body ?? "")}</td>
                          <td>{row.read === true ? "بله" : "خیر"}</td>
                        </tr>
                      ) : (
                        <tr key={index}>
                          <td>{fa(dataPage * PAGE_SIZE + index + 1)}</td>
                          <td dir="ltr">{String(row.number ?? "—")}</td>
                          <td>{epoch(row.date)}</td>
                          <td>{duration(row.durationSeconds)}</td>
                          <td>{row.new === true ? "بله" : "خیر"}</td>
                        </tr>
                      )
                    ) : <tr><td colSpan={5} className="pbr-table-empty">برای این نتیجه داده‌ای موجود نیست.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="pbr-pagination">
                <button type="button" onClick={() => dataCommandId && void loadDataPage(dataCommandId, dataPage - 1)} disabled={dataLoading || dataPage <= 0}><ChevronRight size={16} /> قبلی</button>
                <span>{dataLoading ? "در حال دریافت…" : `صفحه ${fa(dataPage + 1)} از ${fa(totalPages)}`}</span>
                <button type="button" onClick={() => dataCommandId && void loadDataPage(dataCommandId, dataPage + 1)} disabled={dataLoading || dataPage >= totalPages - 1}>بعدی <ChevronLeft size={16} /></button>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="pbr-grid">
        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>اکشن</span><h2><MapPin size={19} /> دریافت لوکیشن</h2></div><MapPin size={20} /></div>
          <div className="pbr-action-row"><div><strong>گرفتن لوکیشن</strong><span>درخواست موقعیت فعلی GPS از گوشی انتخاب‌شده</span></div><button type="button" className="pbr-primary" onClick={() => void runLocation()} disabled={!deviceId || busy}><Navigation size={16} /> اجرا</button></div>
        </article>
        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>نتیجه</span><h2>آخرین لوکیشن</h2></div><MapPin size={20} /></div>
          {(() => {
            const r = lastLocation?.result;
            if (!r || r.latitude == null || r.longitude == null) return <div className="pbr-empty">هنوز نتیجهٔ موفقی برای دریافت لوکیشن ثبت نشده است.</div>;
            const mapUrl = "https://maps.google.com/maps?q=" + r.latitude + "," + r.longitude + "&z=16&output=embed";
            const googleUrl = "https://www.google.com/maps/search/?api=1&query=" + r.latitude + "," + r.longitude;
            return <div><div className="pbr-location"><strong>{r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}</strong><span>دقت: {r.accuracyMeters == null ? "—" : fa(Math.round(r.accuracyMeters)) + " متر"} · منبع: {r.provider || "gps"}</span><span>زمان ثبت: {date(r.recordedAt)} · فرمان: {date(lastLocation?.completedAt)}</span></div><iframe className="pbr-map" title="نتیجه لوکیشن ریموت" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><a className="pbr-map-link" href={googleUrl} target="_blank" rel="noreferrer">باز کردن در Google Maps</a></div>;
          })()}
        </article>
      </section>

      <section className="pbr-card">
        <div className="pbr-card-head"><div><span>سوابق</span><h2>اکشن و نتیجه</h2></div><span>{fa(commands.length)} مورد</span></div>
        <div className="pbr-history">
          {commands.length ? commands.map((command) => {
            const meta = statusMeta(command.status);
            const Icon = meta.Icon;
            const restore = command.action === "restore_data";
            return <div className="pbr-history-row" key={command.id}>
              <div className="pbr-history-action">
                <strong>{command.action === "get_location" ? "گرفتن لوکیشن" : "بازگردانی " + typeLabel(command.result?.dataType ?? command.payload.dataType)}</strong>
                <span>{command.deviceName} · {date(command.createdAt)}</span>
              </div>
              <div className={"pbr-status is-" + command.status}><Icon size={15} /> {meta.text}</div>
              <div className="pbr-history-result">
                {restore
                  ? <span>{command.result?.receivedCount != null ? fa(command.result.receivedCount) + " مورد از " + fa(command.result.requestedCount ?? command.payload.requestedCount ?? 0) + " درخواست" : command.errorMessage || "—"}</span>
                  : command.result?.latitude != null && command.result.longitude != null
                    ? <span>{command.result.latitude.toFixed(6)}, {command.result.longitude.toFixed(6)}</span>
                    : <span>{command.errorMessage || "—"}</span>}
              </div>
            </div>;
          }) : <div className="pbr-empty">هنوز فرمانی ثبت نشده است.</div>}
        </div>
      </section>

      <section className="pbr-security">
        <Radio size={16} />
        <div><strong>تأیید روی گوشی</strong><p>درخواست‌های بازگردانی دیتا فقط بعد از تأیید صریح روی همان گوشی اجرا می‌شوند. کلیدهای موجود «پیامک‌ها» و «تاریخچه تماس‌ها» در اپ تعیین می‌کنند که هر نوع داده قابل درخواست باشد.</p></div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/admin-phone-bridge/remote-control")({
  component: AdminPhoneBridgeRemoteControl,
  head: () => ({ meta: [
    { title: "Phone Bridge · ریموت کنترل" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
});
