import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, Pencil, Plus, RefreshCw, Save, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { TEAM } from "@/lib/site";
import { listAdminConsultants, type Consultant } from "@/lib/consultants";
import {
  deleteAttendance,
  listAttendance,
  saveAttendance,
  type AttendanceRecord,
  type AttendanceSession,
} from "@/lib/attendance";

type StaffOption = Pick<Consultant, "id" | "name" | "role">;

const ATTENDANCE_CSS = `
.admin-attendance-manager{display:grid;gap:18px}
.admin-attendance-summary{display:grid;grid-template-columns:minmax(0,1fr) repeat(2,minmax(130px,auto));gap:16px;align-items:center}
.admin-attendance-summary h2{margin-top:3px;color:var(--admin-ink,#101828)!important;font-size:1.15rem}
.admin-attendance-summary p{margin-top:5px;color:var(--admin-muted,#667085)!important;font-size:.78rem;line-height:1.85}
.admin-attendance-stat{display:grid;gap:3px;min-width:120px;padding:13px 15px;background:var(--admin-surface,#fff);border:1px solid var(--admin-line,#d9dee7);border-radius:12px;text-align:center}
.admin-attendance-stat strong{color:var(--navy-900);font-size:1.2rem}
.admin-attendance-stat span{color:var(--muted);font-size:.72rem}
.admin-attendance-layout{display:grid;grid-template-columns:minmax(340px,.92fr) minmax(0,1.35fr);gap:18px;align-items:start}
.admin-attendance-form{display:grid;gap:16px}
.admin-attendance-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.admin-attendance-toolbar h3{color:var(--navy-900);font-size:1rem}
.admin-attendance-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.admin-attendance-span{grid-column:1/-1}
.admin-attendance-sessions{display:grid;gap:10px}
.admin-attendance-session{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:9px;padding:12px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}
.admin-attendance-session-label{padding-bottom:12px;color:var(--subtle);font-size:.72rem;font-weight:700;white-space:nowrap}
.admin-attendance-session .field{min-width:0}
.admin-attendance-session input{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}
.admin-attendance-remove{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--line-2);border-radius:10px;background:var(--card);color:var(--danger);cursor:pointer}
.admin-attendance-remove:hover{background:var(--danger-bg);border-color:rgb(163 49 39 / 25%)}
.admin-attendance-add{justify-self:start;min-height:42px}
.admin-attendance-total{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;background:var(--brass-100);border:1px solid var(--brass-300);border-radius:var(--r-md)}
.admin-attendance-total span{color:var(--brass-800);font-size:.78rem;font-weight:700}
.admin-attendance-total strong{color:var(--navy-900);font-size:1rem}
.admin-attendance-actions{display:flex;gap:8px;flex-wrap:wrap}
.admin-attendance-note{min-height:90px!important}
.admin-attendance-history{display:grid;gap:12px}
.admin-attendance-history-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.admin-attendance-history-toolbar form{display:flex;align-items:center;gap:8px}
.admin-attendance-date-input{min-height:42px!important;direction:ltr;text-align:center}
.admin-attendance-list{display:grid;gap:10px}
.admin-attendance-record{display:grid;grid-template-columns:minmax(150px,.7fr) minmax(240px,1.3fr) auto;gap:14px;align-items:center;padding:15px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md)}
.admin-attendance-record:hover{border-color:var(--brass-300)}
.admin-attendance-person{display:flex;align-items:center;gap:10px;min-width:0}
.admin-attendance-person-icon{width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;border-radius:10px;background:var(--brass-100);color:var(--brass-700)}
.admin-attendance-person strong{display:block;color:var(--navy-900);font-size:.86rem}
.admin-attendance-person small{display:block;margin-top:2px;color:var(--subtle);font-size:.7rem}
.admin-attendance-record-main{display:grid;gap:7px;min-width:0}
.admin-attendance-date{color:var(--muted);font-size:.76rem;font-weight:700}
.admin-attendance-pills{display:flex;flex-wrap:wrap;gap:6px}
.admin-attendance-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid var(--line);border-radius:999px;background:var(--card-2);color:var(--fg);font-size:.72rem;white-space:nowrap}
.admin-attendance-pill b{color:var(--brass-700)}
.admin-attendance-record-actions{display:flex;justify-content:flex-end;gap:6px}
.admin-attendance-empty{padding:32px 18px;text-align:center;border:1px dashed var(--line-2);border-radius:var(--r-md);background:var(--card-2);color:var(--subtle)}
.admin-attendance-empty strong{display:block;color:var(--navy-900);margin-bottom:5px}
.admin-attendance-hint{color:var(--subtle);font-size:.73rem;line-height:1.8}
@media (max-width:900px){
  .admin-attendance-layout{grid-template-columns:1fr}
  .admin-attendance-summary{grid-template-columns:1fr 1fr}
  .admin-attendance-summary>div:first-child{grid-column:1/-1}
}
@media (max-width:600px){
  .admin-attendance-summary{grid-template-columns:1fr}
  .admin-attendance-summary>div:first-child{grid-column:auto}
  .admin-attendance-fields{grid-template-columns:1fr}
  .admin-attendance-session{grid-template-columns:1fr 1fr auto}
  .admin-attendance-session-label{grid-column:1/-1;padding-bottom:0}
  .admin-attendance-remove{align-self:end}
  .admin-attendance-record{grid-template-columns:1fr}
  .admin-attendance-record-actions{justify-content:flex-start}
  .admin-attendance-history-toolbar form{width:100%}
  .admin-attendance-history-toolbar form .field{flex:1}
}
`;

function tehranToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function faDate(value: string) {
  const date = new Date(value + "T12:00:00");
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function normalizeStaff(items: Consultant[]): StaffOption[] {
  return items.map((item) => ({ id: item.id, name: item.name, role: item.role }));
}

function fallbackStaff(): StaffOption[] {
  return TEAM.map((item) => ({ id: item.id, name: item.name, role: item.role }));
}

function durationMinutes(session: AttendanceSession) {
  const [ih, im] = session.clockIn.split(":").map(Number);
  const [oh, om] = session.clockOut.split(":").map(Number);
  return oh * 60 + om - (ih * 60 + im);
}

function totalMinutes(sessions: AttendanceSession[]) {
  return sessions.reduce((sum, session) => sum + Math.max(0, durationMinutes(session)), 0);
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return mins ? `${hours.toLocaleString("fa-IR")} ساعت و ${mins.toLocaleString("fa-IR")} دقیقه` : `${hours.toLocaleString("fa-IR")} ساعت`;
}

function emptySession(): AttendanceSession {
  return { clockIn: "", clockOut: "" };
}

function emptyForm(staffId = "") {
  return {
    staffId,
    workDate: tehranToday(),
    sessions: [emptySession()],
    note: "",
  };
}

export function AdminAttendanceManager() {
  const [staff, setStaff] = useState<StaffOption[]>(fallbackStaff());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(tehranToday());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === form.staffId) ?? null,
    [staff, form.staffId],
  );

  const totalToday = useMemo(
    () => records.reduce((sum, record) => sum + totalMinutes(record.sessions), 0),
    [records],
  );

  async function refresh(targetDate = selectedDate) {
    setLoading(true);
    try {
      const items = await listAttendance({ data: { fromDate: targetDate, toDate: targetDate } });
      setRecords(items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت ساعات حضور انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const items = await listAdminConsultants();
        if (items.length) setStaff(normalizeStaff(items));
      } catch {
        setStaff(fallbackStaff());
      }
      await refresh(tehranToday());
    })();
  }, []);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(record: AttendanceRecord) {
    setEditingId(record.id);
    setForm({
      staffId: record.consultantId,
      workDate: record.workDate,
      sessions: record.sessions.length ? record.sessions.map((item) => ({ ...item })) : [emptySession()],
      note: record.note,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(staff[0]?.id ?? ""));
  }

  function addSession() {
    setForm((current) => ({ ...current, sessions: [...current.sessions, emptySession()] }));
  }

  function removeSession(index: number) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.length === 1 ? [emptySession()] : current.sessions.filter((_, i) => i !== index),
    }));
  }

  function updateSession(index: number, key: keyof AttendanceSession, value: string) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session, i) => (i === index ? { ...session, [key]: value } : session)),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.staffId || !form.workDate) {
      toast.error("همکار و تاریخ را انتخاب کنید.");
      return;
    }
    const sessions = form.sessions
      .map((item) => ({ clockIn: item.clockIn.trim(), clockOut: item.clockOut.trim() }))
      .filter((item) => item.clockIn || item.clockOut);

    if (!sessions.length) {
      toast.error("حداقل یک بازه ورود و خروج ثبت کنید.");
      return;
    }

    for (const session of sessions) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(session.clockIn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session.clockOut)) {
        toast.error("ساعت‌ها را با فرمت ۲۴ ساعته مثل 09:00 وارد کنید.");
        return;
      }
      if (durationMinutes(session) <= 0) {
        toast.error("ساعت خروج باید بعد از ساعت ورود باشد.");
        return;
      }
    }

    setSaving(true);
    try {
      await saveAttendance({
        data: {
          id: editingId ?? undefined,
          consultantId: form.staffId,
          consultantName: selectedStaff?.name ?? form.staffId,
          workDate: form.workDate,
          sessions,
          note: form.note.trim(),
        },
      });
      toast.success(editingId ? "ساعت حضور ویرایش شد." : "حضور ثبت شد.");
      await refresh(form.workDate);
      setSelectedDate(form.workDate);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت ساعات حضور انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: AttendanceRecord) {
    if (!window.confirm(`ثبت حضور «${record.consultantName}» در ${faDate(record.workDate)} حذف شود؟`)) return;
    try {
      await deleteAttendance({ data: { id: record.id } });
      toast.success("ثبت حضور حذف شد.");
      await refresh();
      if (editingId === record.id) resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف انجام نشد.");
    }
  }

  const isToday = selectedDate === tehranToday();
  const recordsForSelectedDate = records;

  return (
    <section className="admin-attendance-manager">
      <style>{ATTENDANCE_CSS}</style>

      <div className="admin-panel admin-attendance-summary">
        <div>
          <span className="kicker">مدیریت داخلی</span>
          <h2>ساعت ورود و خروج</h2>
          <p>ثبت حضور اعضای بنگاه به تفکیک روز و چند نوبت ورود و خروج؛ این بخش فقط از داخل پنل مدیریت قابل مشاهده است.</p>
        </div>
        <div className="admin-attendance-stat">
          <strong>{recordsForSelectedDate.length.toLocaleString("fa-IR")}</strong>
          <span>{isToday ? "نفر حاضر امروز" : "ثبت حضور در این روز"}</span>
        </div>
        <div className="admin-attendance-stat">
          <strong>{formatDuration(totalToday)}</strong>
          <span>مجموع ساعات ثبت‌شده این روز</span>
        </div>
      </div>

      <div className="admin-attendance-layout">
        <form className="admin-panel admin-attendance-form" onSubmit={submit}>
          <div className="admin-panel-head">
            <div>
              <span className="kicker">{editingId ? "ویرایش ثبت" : "ثبت جدید"}</span>
              <h2>{editingId ? "ویرایش ساعات حضور" : "ثبت حضور همکار"}</h2>
            </div>
            {editingId ? (
              <button type="button" className="admin-icon-btn" onClick={resetForm} title="لغو ویرایش">
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="admin-attendance-fields">
            <label className="field">
              <span>همکار / عضو بنگاه</span>
              <select value={form.staffId} onChange={(e) => updateForm("staffId", e.target.value)} required>
                <option value="">انتخاب همکار</option>
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>تاریخ حضور</span>
              <input
                type="date"
                value={form.workDate}
                onChange={(e) => updateForm("workDate", e.target.value)}
                required
              />
            </label>

            <div className="field admin-attendance-span">
              <span>نوبت‌های حضور</span>
              <div className="admin-attendance-sessions">
                {form.sessions.map((session, index) => (
                  <div className="admin-attendance-session" key={index}>
                    <span className="admin-attendance-session-label">نوبت {String(index + 1).toLocaleString("fa-IR")}</span>
                    <label className="field">
                      <span>ورود</span>
                      <input
                        type="time"
                        value={session.clockIn}
                        onChange={(e) => updateSession(index, "clockIn", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>خروج</span>
                      <input
                        type="time"
                        value={session.clockOut}
                        onChange={(e) => updateSession(index, "clockOut", e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-attendance-remove"
                      onClick={() => removeSession(index)}
                      title="حذف این نوبت"
                      aria-label={`حذف نوبت ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost admin-attendance-add" onClick={addSession}>
                <Plus size={15} /> افزودن نوبت دیگر
              </button>
              <small className="admin-attendance-hint">
                نمونه: نوبت اول ۰۹:۰۰ تا ۱۳:۰۰ و نوبت دوم ۱۷:۰۰ تا ۲۱:۰۰.
              </small>
            </div>

            <div className="admin-attendance-total admin-attendance-span">
              <span>مجموع حضور</span>
              <strong>{formatDuration(totalMinutes(form.sessions))}</strong>
            </div>

            <label className="field admin-attendance-span">
              <span>یادداشت داخلی</span>
              <textarea
                className="admin-attendance-note"
                value={form.note}
                onChange={(e) => updateForm("note", e.target.value)}
                placeholder="مثلاً جلسه عصر، مأموریت، مرخصی ساعتی یا توضیح داخلی"
              />
            </label>
          </div>

          <div className="admin-attendance-actions">
            <button type="submit" className="btn-gold" disabled={saving}>
              {saving ? <RefreshCw size={16} className="admin-spin" /> : <Save size={16} />}
              {editingId ? "ذخیره تغییرات" : "ثبت حضور"}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
                انصراف
              </button>
            ) : null}
          </div>
        </form>

        <section className="admin-panel admin-attendance-history">
          <div className="admin-attendance-history-toolbar">
            <div>
              <div className="admin-panel-head" style={{ margin: 0 }}>
                <div>
                  <span className="kicker">گزارش روز</span>
                  <h2>{isToday ? "حضور امروز" : "حضور ثبت‌شده در روز انتخابی"}</h2>
                </div>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void refresh(selectedDate);
              }}
            >
              <label className="field">
                <span>انتخاب روز</span>
                <input
                  className="admin-attendance-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedDate(value);
                    void refresh(value);
                  }}
                />
              </label>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => {
                  const today = tehranToday();
                  setSelectedDate(today);
                  void refresh(today);
                }}
                title="امروز"
              >
                <CalendarDays size={16} />
              </button>
              <button type="submit" className="admin-icon-btn" title="تازه‌سازی">
                <RefreshCw size={16} className={loading ? "admin-spin" : ""} />
              </button>
            </form>
          </div>

          {loading ? (
            <div className="admin-empty">
              <RefreshCw size={24} className="admin-spin" />
              <strong>در حال دریافت گزارش…</strong>
            </div>
          ) : recordsForSelectedDate.length === 0 ? (
            <div className="admin-attendance-empty">
              <Clock3 size={26} />
              <strong>برای این روز هنوز حضور ثبت نشده است.</strong>
              <span>از فرم سمت راست برای ثبت ساعت ورود و خروج استفاده کنید.</span>
            </div>
          ) : (
            <div className="admin-attendance-list">
              {recordsForSelectedDate.map((record) => (
                <article className="admin-attendance-record" key={record.id}>
                  <div className="admin-attendance-person">
                    <span className="admin-attendance-person-icon"><UserRound size={17} /></span>
                    <div>
                      <strong>{record.consultantName}</strong>
                      <small>{record.consultantId}</small>
                    </div>
                  </div>
                  <div className="admin-attendance-record-main">
                    <div className="admin-attendance-date">{faDate(record.workDate)}</div>
                    <div className="admin-attendance-pills">
                      {record.sessions.map((session, index) => (
                        <span className="admin-attendance-pill" key={index}>
                          <Clock3 size={12} /> نوبت {String(index + 1).toLocaleString("fa-IR")}:{" "}
                          <b dir="ltr">{session.clockIn} تا {session.clockOut}</b>
                        </span>
                      ))}
                    </div>
                    {record.note ? <small className="admin-attendance-hint">{record.note}</small> : null}
                  </div>
                  <div className="admin-attendance-record-actions">
                    <strong title="مجموع حضور" style={{ color: "var(--brass-700)", fontSize: ".78rem", marginInlineEnd: "auto" }}>
                      {formatDuration(totalMinutes(record.sessions))}
                    </strong>
                    <button type="button" className="admin-icon-btn" onClick={() => edit(record)} title="ویرایش">
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="admin-icon-btn" onClick={() => void remove(record)} title="حذف">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
