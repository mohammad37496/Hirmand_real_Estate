import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, MapPin, RefreshCw, Radio, CheckCircle2, Clock3, XCircle, Navigation, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  createPhoneBridgeRemoteCommand,
  getPhoneBridgeRemoteCommand,
  listPhoneBridgeRemoteCommands,
  type PhoneBridgeRemoteCommand,
} from "@/lib/admin-phone-bridge-remote";
import { listPhoneBridgeDevices, type PhoneBridgeDevice } from "@/lib/admin-phone-bridge";
import "@/admin-phone-bridge-remote.css";

function fa(value: number) { return value.toLocaleString("fa-IR"); }
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString("fa-IR") : "—"; }
function accuracy(value: number | null | undefined) { return value == null ? "—" : fa(Math.round(value)) + " متر"; }

const ACTIONS = [{ value: "get_location", label: "گرفتن لوکیشن" }] as const;

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

  async function runLocation() {
    if (!deviceId) return;
    setBusy(true);
    setRunningId(null);
    try {
      const created = await createPhoneBridgeRemoteCommand({ data: { deviceId, action: "get_location" } });
      if (!created.success || !created.commandId) throw new Error("ثبت فرمان ریموت انجام نشد.");
      setRunningId(created.commandId);
      toast.success("فرمان «گرفتن لوکیشن» به صف گوشی ارسال شد.");

      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const result = await getPhoneBridgeRemoteCommand({ data: { commandId: created.commandId } });
        if (!result) break;
        setCommands((current) => [result, ...current.filter((item) => item.id !== result.id)].slice(0, 20));
        if (result.status === "succeeded") {
          toast.success("لوکیشن با موفقیت از گوشی دریافت شد.");
          break;
        }
        if (result.status === "failed" || result.status === "expired") {
          toast.error(result.errorMessage || "دریافت لوکیشن ناموفق بود.");
          break;
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "اجرای فرمان ریموت انجام نشد.");
    } finally {
      setRunningId(null);
      setBusy(false);
      void load();
    }
  }

  return (
    <main className="pbr-page" dir="rtl">
      <header className="pbr-header">
        <div>
          <span>Phone Bridge · ریموت کنترل</span>
          <h1>کنترل ریموت دستگاه</h1>
          <p>فعلاً فقط اکشن «گرفتن لوکیشن» فعال است؛ اکشن‌های بعدی را می‌توانیم به همین ساختار اضافه کنیم.</p>
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
            <span>اکشن</span>
            <button type="button" className="pbr-primary" onClick={() => void runLocation()} disabled={!deviceId || busy}>
              <MapPin size={18} /> {runningId ? "در حال دریافت لوکیشن…" : ACTIONS[0].label}
            </button>
          </div>
        </div>
        <div className="pbr-note">
          <Smartphone size={16} />
          <span>برای دریافت فوری، روی گوشی باید «ریموت کنترل» فعال باشد و سرویس ریموتِ قابل‌مشاهده در حال اجرا باشد. فرمان با احراز هویت و امضای دستگاه ارسال می‌شود.</span>
        </div>
      </section>

      <section className="pbr-grid">
        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>اکشن</span><h2>دریافت لوکیشن</h2></div><MapPin size={20} /></div>
          <div className="pbr-action-row">
            <div><strong>گرفتن لوکیشن</strong><span>درخواست موقعیت فعلی GPS از گوشی انتخاب‌شده</span></div>
            <button type="button" className="pbr-primary" onClick={() => void runLocation()} disabled={!deviceId || busy}><Navigation size={16} /> اجرا</button>
          </div>
        </article>

        <article className="pbr-card">
          <div className="pbr-card-head"><div><span>نتیجه</span><h2>آخرین نتیجه</h2></div><Radio size={20} /></div>
          {(() => {
            const last = commands.find((item) => item.action === "get_location" && item.status === "succeeded" && item.result);
            if (!last?.result?.latitude || !last.result?.longitude) {
              return <div className="pbr-empty">هنوز نتیجهٔ موفقی برای دریافت لوکیشن ثبت نشده است.</div>;
            }
            const r = last.result;
            const mapUrl = "https://maps.google.com/maps?q=" + r.latitude + "," + r.longitude + "&z=16&output=embed";
            const googleUrl = "https://www.google.com/maps/search/?api=1&query=" + r.latitude + "," + r.longitude;
            return (
              <div>
                <div className="pbr-location">
                  <strong>{r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}</strong>
                  <span>دقت: {accuracy(r.accuracyMeters)} · منبع: {r.provider || "gps"}</span>
                  <span>زمان ثبت روی گوشی: {date(r.recordedAt)} · فرمان: {date(last.completedAt)}</span>
                </div>
                <iframe className="pbr-map" title="نتیجه لوکیشن ریموت" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                <a className="pbr-map-link" href={googleUrl} target="_blank" rel="noreferrer">باز کردن در Google Maps</a>
              </div>
            );
          })()}
        </article>
      </section>

      <section className="pbr-card">
        <div className="pbr-card-head"><div><span>سوابق</span><h2>اکشن و نتیجه</h2></div><span>{fa(commands.length)} مورد</span></div>
        <div className="pbr-history">
          {commands.length ? commands.map((command) => {
            const meta = statusMeta(command.status);
            const Icon = meta.Icon;
            return (
              <div className="pbr-history-row" key={command.id}>
                <div className="pbr-history-action">
                  <strong>{command.action === "get_location" ? "گرفتن لوکیشن" : command.action}</strong>
                  <span>{command.deviceName} · {date(command.createdAt)}</span>
                </div>
                <div className={"pbr-status is-" + command.status}><Icon size={15} /> {meta.text}</div>
                <div className="pbr-history-result">
                  {command.result?.latitude != null && command.result.longitude != null
                    ? <span>{command.result.latitude.toFixed(6)}, {command.result.longitude.toFixed(6)} · دقت {accuracy(command.result.accuracyMeters)}</span>
                    : <span>{command.errorMessage || "—"}</span>}
                </div>
              </div>
            );
          }) : <div className="pbr-empty">هنوز فرمانی ثبت نشده است.</div>}
        </div>
      </section>

      <section className="pbr-security">
        <Radio size={16} />
        <div>
          <strong>کنترل شفاف و محدود</strong>
          <p>این بخش فعلاً فقط برای دستگاهی طراحی شده که خودت در Phone Bridge ثبت کرده‌ای. روی گوشی اعلان سرویس ریموت نمایش داده می‌شود و فقط اکشن‌هایی که در سرور مجاز شده‌اند قابل اجرا هستند.</p>
        </div>
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
