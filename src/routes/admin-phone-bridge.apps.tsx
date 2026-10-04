import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Search, Ban, ShieldCheck, CalendarDays, Smartphone, Trash2, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  deletePhoneBridgeAppBlockRule,
  listPhoneBridgeAppBlockRules,
  listPhoneBridgeApps,
  savePhoneBridgeAppBlockRule,
  type PhoneBridgeApp,
  type PhoneBridgeAppBlockRule,
} from "@/lib/admin-phone-bridge-apps";
import "@/admin-phone-bridge-apps.css";

const DAYS = [
  { value: 0, label: "شنبه" },
  { value: 1, label: "یکشنبه" },
  { value: 2, label: "دوشنبه" },
  { value: 3, label: "سه‌شنبه" },
  { value: 4, label: "چهارشنبه" },
  { value: 5, label: "پنجشنبه" },
  { value: 6, label: "جمعه" },
] as const;

function fa(value: number) { return value.toLocaleString("fa-IR"); }
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString("fa-IR") : "—"; }

export function AdminPhoneBridgeApps() {
  const [devices, setDevices] = useState<{ id: string; name: string; model: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [apps, setApps] = useState<PhoneBridgeApp[]>([]);
  const [rules, setRules] = useState<PhoneBridgeAppBlockRule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorApp, setEditorApp] = useState<PhoneBridgeApp | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorEnabled, setEditorEnabled] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([0,1,2,3]);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("12:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const pageCount = Math.max(1, Math.ceil(total / 20));

  const loadDevices = useCallback(async () => {
    const result = await (await import("@/lib/admin-phone-bridge")).listPhoneBridgeDevices({ data: { limit: 100 } });
    const mapped = result.map((d) => ({ id: d.id, name: d.name, model: d.model }));
    setDevices(mapped);
    if (!deviceId && mapped[0]) setDeviceId(mapped[0].id);
  }, [deviceId]);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setBusy(true);
    try {
      const [appResult, ruleResult] = await Promise.all([
        listPhoneBridgeApps({ data: { deviceId, page, limit: 20, ...(search.trim() ? { search: search.trim() } : {}) } }),
        listPhoneBridgeAppBlockRules({ data: { deviceId } }),
      ]);
      setApps(appResult.apps);
      setTotal(appResult.total);
      setRules(ruleResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت برنامه‌ها انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [deviceId, page, search]);

  useEffect(() => { void loadDevices(); }, [loadDevices]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const ruleByPackage = useMemo(() => new Map(rules.map((r) => [r.packageName, r])), [rules]);

  function edit(app: PhoneBridgeApp) {
    const rule = ruleByPackage.get(app.packageName);
    setEditorApp(app);
    setEditorEnabled(rule?.enabled ?? true);
    setSelectedDays(rule?.days?.length ? rule.days : [0,1,2,3]);
    setStartTime(rule?.startTime ?? "07:00");
    setEndTime(rule?.endTime ?? "12:00");
    setStartDate(rule?.startDate ?? "");
    setEndDate(rule?.endDate ?? "");
    setMessage(rule?.message ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!editorApp) return;
    if (!selectedDays.length) return void toast.error("حداقل یک روز را انتخاب کن.");
    if (startDate && endDate && startDate > endDate) return void toast.error("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
    setSaving(true);
    try {
      const result = await savePhoneBridgeAppBlockRule({ data: {
        deviceId, packageName: editorApp.packageName, label: editorApp.label, enabled: editorEnabled, days: selectedDays,
        startTime, endTime, startDate, endDate, message,
      }});
      if (result.success) { toast.success("قانون بلاک برنامه ذخیره شد."); setEditorApp(null); await load(); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیره قانون بلاک انجام نشد."); }
    finally { setSaving(false); }
  }

  async function removeRule(app: PhoneBridgeApp) {
    if (!window.confirm("قانون بلاک «" + (app.label || app.packageName) + "» حذف شود؟")) return;
    try {
      const result = await deletePhoneBridgeAppBlockRule({ data: { deviceId, packageName: app.packageName }});
      if (result.success) { toast.success("قانون بلاک حذف شد."); await load(); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "حذف قانون بلاک انجام نشد."); }
  }

  function toggleDay(day: number) {
    setSelectedDays((current) => current.includes(day) ? current.filter((x) => x !== day) : [...current, day].sort((a,b) => a-b));
  }

  return (
    <main className="pba-page" dir="rtl">
      <header className="pba-header">
        <div>
          <span>Phone Bridge · برنامه‌ها</span>
          <h1>برنامه‌های نصب‌شده و بلاک زمان‌بندی‌شده</h1>
          <p>همهٔ برنامه‌های ثبت‌شدهٔ گوشی در این بخش نمایش داده می‌شوند؛ هر صفحه دقیقاً ۲۰ برنامه دارد.</p>
        </div>
        <div className="pba-actions">
          <Link to="/admin-phone-bridge"><ArrowRight size={16} /> Phone Bridge</Link>
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> بروزرسانی</button>
        </div>
      </header>

      {editorApp ? <section className="pba-card pba-editor">
        <div className="pba-card-head">
          <div><span>تنظیم بلاک</span><h2><Ban size={18} /> {editorApp.label || editorApp.packageName}</h2></div>
          <button type="button" className="pba-close" onClick={() => setEditorApp(null)}>بستن</button>
        </div>
        <div className="pba-app-subtitle">{editorApp.packageName} · نسخه {editorApp.versionName || "—"}</div>
        <div className="pba-editor-grid">
          <label className="pba-check"><input type="checkbox" checked={editorEnabled} onChange={(e) => setEditorEnabled(e.target.checked)} /><span>قانون فعال باشد</span></label>
          <label className="pba-field"><span>ساعت شروع</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label className="pba-field"><span>ساعت پایان</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
          <label className="pba-field"><span>تاریخ شروع (اختیاری)</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="pba-field"><span>تاریخ پایان (اختیاری)</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        </div>
        <div className="pba-days">
          <div className="pba-label"><CalendarDays size={16} /> روزهای هفته</div>
          <div className="pba-day-grid">{DAYS.map((day) => <button type="button" key={day.value} className={selectedDays.includes(day.value) ? "is-selected" : ""} onClick={() => toggleDay(day.value)}>{day.label}</button>)}</div>
        </div>
        <label className="pba-message"><span>متن هنگام بلاک</span><textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="مثلاً: زمان مطالعه است؛ این برنامه تا ساعت ۱۲ مسدود است." /></label>
        <div className="pba-editor-actions">
          <button type="button" onClick={() => void save()} disabled={saving || !selectedDays.length}><CheckCircle2 size={16} /> {saving ? "در حال ذخیره…" : "ذخیره بلاک"}</button>
          <button type="button" className="pba-secondary" onClick={() => setEditorApp(null)}>انصراف</button>
          {ruleByPackage.has(editorApp.packageName) ? <button type="button" className="pba-danger" onClick={() => void removeRule(editorApp)}><Trash2 size={16} /> حذف بلاک</button> : null}
        </div>
      </section> : null}

      <section className="pba-card pba-toolbar">
        <div className="pba-toolbar-grid">
          <label><span>دستگاه</span><select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setPage(1); }}>
            {devices.length === 0 ? <option value="">دستگاهی نیست</option> : null}
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.model}</option>)}
          </select></label>
          <label><span>جستجو</span><div className="pba-search"><Search size={16} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="نام برنامه یا package" /></div></label>
        </div>
        <div className="pba-stats">
          <span><Smartphone size={15} /> {fa(total)} برنامه</span>
          <span><Ban size={15} /> {fa(rules.filter((r) => r.enabled).length)} قانون فعال</span>
          <span><ShieldCheck size={15} /> فقط دستگاه انتخاب‌شده</span>
        </div>
        <div className="pba-note">برای اجرای بلاک روی گوشی، «مدیریت بلاک برنامه‌ها» و سرویس Accessibility هیرمند باید یک‌بار خودت روی گوشی فعال کرده باشی. زمان‌بندی بر اساس ساعت محلی خود گوشی اجرا می‌شود.</div>
      </section>

      <section className="pba-app-grid">
        {busy ? <div className="pba-card pba-empty">در حال دریافت برنامه‌ها…</div> :
        apps.length === 0 ? <div className="pba-card pba-empty">برنامه‌ای پیدا نشد؛ در گوشی ماژول «برنامه‌های قابل اجرا» را روشن و Sync را اجرا کن.</div> :
        apps.map((app) => {
          const rule = ruleByPackage.get(app.packageName);
          return <article className="pba-card pba-app-card" key={app.id}>
            <div className="pba-app-main"><div className="pba-app-icon"><Smartphone size={20} /></div><div>
              <h3>{app.label || app.packageName}</h3><p>{app.packageName}</p>
              <div className="pba-meta"><span>{app.versionName ? "نسخه " + app.versionName : "نسخه نامشخص"}</span><span>{app.isSystemApp ? "سیستمی" : "کاربری"}</span><span>{app.enabled ? "فعال" : "غیرفعال"}</span></div>
              <small>آخرین مشاهده: {date(app.lastSeenAt)}</small>
            </div></div>
            {rule ? <div className={"pba-rule " + (rule.enabled ? "is-active" : "is-off")}><strong>{rule.enabled ? "بلاک فعال" : "بلاک خاموش"}</strong><span>{rule.days.map((d) => DAYS[d]?.label).filter(Boolean).join("، ")} · {rule.startTime} تا {rule.endTime}</span>{rule.message ? <p>{rule.message}</p> : null}</div> : <div className="pba-no-rule">برای این برنامه بلاکی تنظیم نشده است.</div>}
            <div className="pba-app-actions">
              <button type="button" onClick={() => edit(app)}><Ban size={16} /> {rule ? "ویرایش بلاک" : "بلاک"}</button>
              {rule ? <button type="button" className="pba-secondary" onClick={() => void removeRule(app)}><Trash2 size={16} /> حذف بلاک</button> : null}
            </div>
          </article>;
        })}
      </section>

      <section className="pba-pagination">
        <button type="button" disabled={page <= 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))}>قبلی</button>
        <span>صفحه {fa(page)} از {fa(pageCount)} · {fa(total)} برنامه</span>
        <button type="button" disabled={page >= pageCount || busy} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>بعدی</button>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/admin-phone-bridge/apps")({
  component: AdminPhoneBridgeApps,
  head: () => ({ meta: [
    { title: "Phone Bridge · برنامه‌ها | گروه مشاورین املاک هیرمند" },
    { name: "description", content: "مدیریت برنامه‌های نصب‌شده و بلاک زمان‌بندی‌شدهٔ Phone Bridge" },
  ]}),
});
