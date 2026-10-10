import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Clock3,
  Download,
  Printer,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
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
import { formatPersianDate, formatPersianDateWithWeekday } from "@/lib/persian-date";
import { PersianDatePicker } from "./persian-date-picker";

type StaffOption = Pick<Consultant, "id" | "name" | "role">;
type ReportRange = "day" | "week" | "month";
type CameraBridgeEvent = {
  eventId: string;
  consultantId: string;
  consultantName: string;
  direction: "entry" | "exit";
  occurredAt: string;
  cameraId: string;
  matchScore: number;
  status: "received" | "applied" | "duplicate" | "needs_review" | "reviewed";
  resultNote: string;
};
type CameraBridgeResponse = {
  configured: boolean;
  needsReviewCount: number;
  events: CameraBridgeEvent[];
};

const ATTENDANCE_CSS = `
.admin-attendance-manager{display:grid;gap:18px}
.admin-attendance-camera{display:grid;gap:12px;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--el-1)}
.admin-attendance-camera-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.admin-attendance-camera-title{display:flex;align-items:flex-start;gap:10px;min-width:0}
.admin-attendance-camera-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:11px;background:var(--brass-100);color:var(--brass-700)}
.admin-attendance-camera-title h3{margin:0;color:var(--navy-900);font-size:.95rem}
.admin-attendance-camera-title p{margin:4px 0 0;color:var(--muted);font-size:.74rem;line-height:1.8}
.admin-attendance-camera-status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid var(--line);border-radius:999px;background:var(--card-2);font-size:.72rem;font-weight:800;color:var(--muted)}
.admin-attendance-camera-status.is-ready{border-color:var(--brass-300);background:var(--brass-100);color:var(--brass-800)}
.admin-attendance-camera-status.is-warning{border-color:var(--line-2);color:var(--danger)}
.admin-attendance-camera-note{margin:0;color:var(--subtle);font-size:.72rem;line-height:1.9}
.admin-attendance-camera-events{display:grid;gap:7px}
.admin-attendance-camera-event{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(120px,.7fr) minmax(0,1.5fr) auto;gap:10px;align-items:center;padding:10px 12px;background:var(--card-2);border:1px solid var(--line);border-radius:11px}
.admin-attendance-camera-event strong{font-size:.76rem;color:var(--navy-900)}
.admin-attendance-camera-event small{font-size:.68rem;color:var(--muted);line-height:1.7}
.admin-attendance-camera-event-status{font-size:.69rem;font-weight:800;color:var(--brass-700);white-space:nowrap}
.admin-attendance-camera-empty{padding:12px;border:1px dashed var(--line-2);border-radius:11px;color:var(--subtle);font-size:.74rem}
@media(max-width:700px){.admin-attendance-camera-event{grid-template-columns:1fr 1fr}.admin-attendance-camera-head{align-items:stretch}.admin-attendance-camera-event-status{white-space:normal}}
@media(max-width:460px){.admin-attendance-camera-event{grid-template-columns:1fr}.admin-attendance-camera-title p{font-size:.72rem}}
.admin-attendance-hero{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(4,minmax(115px,.55fr));gap:12px;align-items:stretch}
.admin-attendance-hero-main{padding:20px;background:linear-gradient(135deg,var(--card),var(--card-2));border:1px solid var(--line);border-top:4px solid var(--brass-500);border-radius:var(--r-lg);box-shadow:var(--el-1)}
.admin-attendance-hero-main h2{margin:4px 0 4px;color:var(--navy-900);font-size:1.2rem}
.admin-attendance-hero-main p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.9}
.admin-attendance-hero-main .kicker{color:var(--brass-700)}
.admin-attendance-stat{display:grid;align-content:center;gap:4px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--el-1);text-align:center}
.admin-attendance-stat strong{color:var(--navy-900);font-size:1.12rem;font-variant-numeric:tabular-nums}
.admin-attendance-stat span{color:var(--subtle);font-size:.69rem;line-height:1.6}
.admin-attendance-stat.is-accent{background:var(--brass-100);border-color:var(--brass-300)}
.admin-attendance-stat.is-accent strong{color:var(--brass-800)}
.admin-attendance-layout{display:grid;grid-template-columns:minmax(350px,.9fr) minmax(0,1.5fr);gap:18px;align-items:start}
.admin-attendance-form,.admin-attendance-history,.admin-attendance-report{display:grid;gap:15px}
.admin-attendance-form .admin-panel-head,.admin-attendance-history .admin-panel-head{margin-bottom:0}
.admin-attendance-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.admin-attendance-span{grid-column:1/-1}
.admin-attendance-date-wrap{position:relative}
.admin-attendance-date-wrap .persian-date-picker{width:100%}
.admin-attendance-date-wrap .persian-date-picker-trigger{width:100%;min-height:44px;justify-content:space-between}
.admin-attendance-date-wrap .persian-date-picker-trigger svg{color:var(--brass-700)}
.admin-attendance-sessions{display:grid;gap:9px}
.admin-attendance-session{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:9px;padding:11px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}
.admin-attendance-session-label{padding-bottom:11px;color:var(--subtle);font-size:.7rem;font-weight:800;white-space:nowrap}
.admin-attendance-session .field{min-width:0}
.admin-attendance-session input{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}
.admin-attendance-remove{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--line-2);border-radius:10px;background:var(--card);color:var(--danger);cursor:pointer}
.admin-attendance-remove:hover{background:var(--danger-bg);border-color:rgb(163 49 39 / 25%)}
.admin-attendance-add{justify-self:start;min-height:40px}
.admin-attendance-hint{color:var(--subtle);font-size:.71rem;line-height:1.8}
.admin-attendance-total{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;background:var(--brass-100);border:1px solid var(--brass-300);border-radius:var(--r-md)}
.admin-attendance-total span{color:var(--brass-800);font-size:.76rem;font-weight:800}
.admin-attendance-total strong{color:var(--navy-900);font-size:.92rem}
.admin-attendance-actions{display:flex;gap:8px;flex-wrap:wrap}
.admin-attendance-note{min-height:84px!important}
.admin-attendance-history-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px}
.admin-attendance-range-tabs{display:flex;gap:5px;padding:4px;background:var(--card-2);border:1px solid var(--line);border-radius:12px}
.admin-attendance-range-tabs button{border:0;background:transparent;color:var(--muted);border-radius:9px;padding:7px 10px;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer}
.admin-attendance-range-tabs button.is-active{background:var(--navy-900);color:#fff}
.admin-attendance-filterbar{display:grid;grid-template-columns:minmax(190px,1fr) minmax(220px,1fr) auto;gap:9px;align-items:end;padding:12px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}
.admin-attendance-filterbar .field{min-width:0}
.admin-attendance-filterbar .persian-date-picker{width:100%}
.admin-attendance-filterbar .persian-date-picker-trigger{width:100%;min-height:42px}
.admin-attendance-filterbar-actions{display:flex;gap:7px}
.admin-attendance-list{display:grid;gap:10px}
.admin-attendance-record{display:grid;grid-template-columns:minmax(150px,.6fr) minmax(250px,1.55fr) auto;gap:14px;align-items:center;padding:15px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);transition:border-color .18s ease,box-shadow .18s ease}
.admin-attendance-record:hover{border-color:var(--brass-300);box-shadow:var(--el-1)}
.admin-attendance-person{display:flex;align-items:center;gap:10px;min-width:0}
.admin-attendance-person-icon{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;border-radius:11px;background:var(--brass-100);color:var(--brass-700)}
.admin-attendance-person strong{display:block;color:var(--navy-900);font-size:.84rem}
.admin-attendance-person small{display:block;margin-top:2px;color:var(--subtle);font-size:.67rem}
.admin-attendance-record-main{display:grid;gap:7px;min-width:0}
.admin-attendance-date{color:var(--muted);font-size:.73rem;font-weight:800}
.admin-attendance-pills{display:flex;flex-wrap:wrap;gap:6px}
.admin-attendance-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid var(--line);border-radius:999px;background:var(--card-2);color:var(--fg);font-size:.71rem;white-space:nowrap}
.admin-attendance-pill b{color:var(--brass-700)}
.admin-attendance-record-actions{display:flex;justify-content:flex-end;align-items:center;gap:6px}
.admin-attendance-record-total{margin-inline-end:auto;color:var(--brass-700);font-size:.75rem;white-space:nowrap}
.admin-attendance-empty{display:grid;justify-items:center;gap:6px;padding:34px 18px;text-align:center;border:1px dashed var(--line-2);border-radius:var(--r-md);background:var(--card-2);color:var(--subtle)}
.admin-attendance-empty strong{color:var(--navy-900)}
.admin-attendance-report{grid-column:1/-1}
.admin-attendance-report-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
.admin-attendance-report-head h3{margin:2px 0 0;color:var(--navy-900);font-size:.95rem}
.admin-attendance-report-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.admin-attendance-report-card{display:grid;gap:3px;padding:13px 14px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}
.admin-attendance-report-card strong{color:var(--navy-900);font-size:1rem}
.admin-attendance-report-card span{color:var(--subtle);font-size:.69rem}
.admin-attendance-staff-breakdown{display:grid;gap:8px}
.admin-attendance-staff-row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(110px,.55fr) minmax(110px,.55fr) minmax(120px,.65fr);gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--card)}
.admin-attendance-staff-row strong{color:var(--navy-900);font-size:.76rem}
.admin-attendance-staff-row span{color:var(--muted);font-size:.7rem}
.admin-attendance-staff-row b{color:var(--brass-700);font-size:.73rem}
.admin-attendance-progress{height:7px;overflow:hidden;border-radius:999px;background:var(--line)}
.admin-attendance-progress span{display:block;height:100%;border-radius:inherit;background:var(--brass-500)}
.admin-attendance-print{white-space:nowrap}
@media (max-width:1100px){
  .admin-attendance-hero{grid-template-columns:minmax(0,1fr) repeat(2,minmax(125px,.5fr))}
  .admin-attendance-hero-main{grid-column:1/-1}
  .admin-attendance-layout{grid-template-columns:1fr}
  .admin-attendance-report-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:700px){
  .admin-attendance-fields{grid-template-columns:1fr}
  .admin-attendance-filterbar{grid-template-columns:1fr}
  .admin-attendance-range-tabs{width:100%}
  .admin-attendance-range-tabs button{flex:1}
  .admin-attendance-session{grid-template-columns:1fr 1fr auto}
  .admin-attendance-session-label{grid-column:1/-1;padding-bottom:0}
  .admin-attendance-remove{align-self:end}
  .admin-attendance-record{grid-template-columns:1fr}
  .admin-attendance-record-actions{justify-content:flex-start}
  .admin-attendance-report-grid{grid-template-columns:1fr 1fr}
  .admin-attendance-staff-row{grid-template-columns:1fr 1fr}
}
@media (max-width:460px){
  .admin-attendance-hero{grid-template-columns:1fr}
  .admin-attendance-hero-main{grid-column:auto}
  .admin-attendance-report-grid{grid-template-columns:1fr}
  .admin-attendance-record-actions{flex-wrap:wrap}
  .admin-attendance-record-total{width:100%;margin:0}
  .admin-attendance-session{grid-template-columns:1fr auto}
  .admin-attendance-session .field{min-width:0}
}
@media print{
  .admin-attendance-form,.admin-attendance-actions,.admin-attendance-record-actions,.admin-attendance-filterbar-actions,.admin-attendance-range-tabs,.admin-attendance-print{display:none!important}
  .admin-attendance-layout{grid-template-columns:1fr}
  .admin-attendance-history,.admin-attendance-report{box-shadow:none!important}
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

function addDays(value: string, amount: number) {
  const date = new Date(value + "T12:00:00");
  date.setDate(date.getDate() + amount);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfWeek(value: string) {
  const date = new Date(value + "T12:00:00");
  const day = date.getDay();
  return addDays(value, day === 0 ? -6 : 1 - day);
}

function endOfWeek(value: string) {
  return addDays(startOfWeek(value), 6);
}

function startOfMonth(value: string) {
  const date = new Date(value + "T12:00:00");
  date.setDate(1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");
}

function endOfMonth(value: string) {
  const date = new Date(startOfMonth(value) + "T12:00:00");
  date.setMonth(date.getMonth() + 1, 0);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function rangeFor(mode: ReportRange, anchor: string) {
  if (mode === "week") return { fromDate: startOfWeek(anchor), toDate: endOfWeek(anchor) };
  if (mode === "month") return { fromDate: startOfMonth(anchor), toDate: endOfMonth(anchor) };
  return { fromDate: anchor, toDate: anchor };
}

function faDate(value: string) {
  return formatPersianDateWithWeekday(value);
}

function normalizeStaff(items: Consultant[]): StaffOption[] {
  return items.map((item) => ({ id: item.id, name: item.name, role: item.role }));
}

function fallbackStaff(): StaffOption[] {
  return TEAM.map((item) => ({ id: item.id, name: item.name, role: item.role }));
}

function durationMinutes(session: AttendanceSession, workDate?: string) {
  const validIn = /^([01]\d|2[0-3]):[0-5]\d$/.test(session.clockIn);
  const validOut = /^([01]\d|2[0-3]):[0-5]\d$/.test(session.clockOut);
  if (!validIn) return 0;
  const [ih, im] = session.clockIn.split(":").map(Number);
  if (!session.clockOut && workDate === tehranToday()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date()).split(":").map(Number);
    return Math.max(0, parts[0] * 60 + parts[1] - (ih * 60 + im));
  }
  if (!validOut) return 0;
  const [oh, om] = session.clockOut.split(":").map(Number);
  return Math.max(0, oh * 60 + om - (ih * 60 + im));
}

function totalMinutes(sessions: AttendanceSession[], workDate?: string) {
  return sessions.reduce((sum, session) => sum + durationMinutes(session, workDate), 0);
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours && !mins) return "۰ ساعت";
  return mins
    ? `${hours.toLocaleString("fa-IR")} ساعت و ${mins.toLocaleString("fa-IR")} دقیقه`
    : `${hours.toLocaleString("fa-IR")} ساعت`;
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

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function cameraStatusLabel(status: CameraBridgeEvent["status"]) {
  if (status === "applied") return "ثبت شد";
  if (status === "duplicate") return "تکراری";
  if (status === "received") return "در انتظار پردازش";
  if (status === "reviewed") return "بررسی شد";
  return "نیازمند بررسی";
}
function cameraDirectionLabel(direction: CameraBridgeEvent["direction"]) {
  return direction === "entry" ? "ورود" : "خروج";
}
function cameraEventTime(value: string) {
  return new Date(value).toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short",
  });
}

function selectedRangeTitle(mode: ReportRange, anchor: string) {
  if (mode === "week") return `هفته منتهی به ${formatPersianDate(anchor)}`;
  if (mode === "month") return `گزارش ماه ${formatPersianDate(anchor)}`;
  return formatPersianDateWithWeekday(anchor);
}

export function AdminAttendanceManager() {
  const [staff, setStaff] = useState<StaffOption[]>(fallbackStaff());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(tehranToday());
  const [rangeMode, setRangeMode] = useState<ReportRange>("day");
  const [staffFilter, setStaffFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cameraEvents, setCameraEvents] = useState<CameraBridgeEvent[]>([]);
  const [cameraConfigured, setCameraConfigured] = useState<boolean | null>(null);
  const [cameraReviewCount, setCameraReviewCount] = useState(0);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === form.staffId) ?? null,
    [staff, form.staffId],
  );

  const currentRange = useMemo(() => rangeFor(rangeMode, anchorDate), [rangeMode, anchorDate]);

  const filteredRecords = useMemo(
    () =>
      staffFilter === "all"
        ? records
        : records.filter((record) => record.consultantId === staffFilter),
    [records, staffFilter],
  );

  const reportStats = useMemo(() => {
    const uniqueStaff = new Set(filteredRecords.map((record) => record.consultantId));
    const minutes = filteredRecords.reduce((sum, record) => sum + totalMinutes(record.sessions, record.workDate), 0);
    const sessions = filteredRecords.reduce((sum, record) => sum + record.sessions.length, 0);
    const activeDays = new Set(filteredRecords.map((record) => record.workDate)).size;
    return {
      people: uniqueStaff.size,
      records: filteredRecords.length,
      minutes,
      sessions,
      activeDays,
    };
  }, [filteredRecords]);

  const staffBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; role: string; records: number; minutes: number; days: number }>();
    for (const record of filteredRecords) {
      const existing = map.get(record.consultantId);
      if (existing) {
        existing.records += 1;
        existing.minutes += totalMinutes(record.sessions, record.workDate);
        existing.days += 1;
      } else {
        const person = staff.find((item) => item.id === record.consultantId);
        map.set(record.consultantId, {
          name: record.consultantName,
          role: person?.role ?? "عضو بنگاه",
          records: 1,
          minutes: totalMinutes(record.sessions, record.workDate),
          days: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [filteredRecords, staff]);

  const peakMinutes = Math.max(1, ...staffBreakdown.map((item) => item.minutes));

  async function refreshCameraEvents() {
    setCameraLoading(true);
    setCameraError("");
    try {
      const response = await fetch("/api/attendance-camera-events", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("دریافت رویدادهای دوربین انجام نشد.");
      const result = await response.json() as CameraBridgeResponse;
      setCameraConfigured(Boolean(result.configured));
      setCameraReviewCount(Number(result.needsReviewCount) || 0);
      setCameraEvents(Array.isArray(result.events) ? result.events : []);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "وضعیت پل دوربین دریافت نشد.");
    } finally {
      setCameraLoading(false);
    }
  }

  async function markCameraEventReviewed(item: CameraBridgeEvent) {
    try {
      const response = await fetch("/api/attendance-camera-events", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_reviewed", eventId: item.eventId }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string; statusMessage?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.statusMessage || result.message || "ثبت بررسی رویداد انجام نشد.");
      }
      toast.success("رویداد به‌عنوان بررسی‌شده علامت خورد؛ اصلاح ساعت‌ها را جداگانه کنترل کنید.");
      await refreshCameraEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت بررسی رویداد انجام نشد.");
    }
  }

  async function refresh(mode = rangeMode, anchor = anchorDate, filter = staffFilter, silent = false) {
    if (!silent) setLoading(true);
    try {
      const range = rangeFor(mode, anchor);
      const items = await listAttendance({ data: range });
      setRecords(filter === "all" ? items : items.filter((record) => record.consultantId === filter));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت گزارش حضور انجام نشد.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Bootstraps the consultant list and the first day's report, once. `refresh`
  // is intentionally not a dependency: it reads the mode/anchor/filter state
  // that this mount pass is establishing, so re-running on those changes would
  // re-fetch on every filter click before the list is even in place.
  useEffect(() => {
    void (async () => {
      try {
        const items = await listAdminConsultants();
        if (items.length) {
          setStaff(normalizeStaff(items));
          setForm(emptyForm(items[0]?.id ?? ""));
        }
      } catch {
        setStaff(fallbackStaff());
        setForm(emptyForm(fallbackStaff()[0]?.id ?? ""));
      }
      await refresh("day", tehranToday(), "all");
      await refreshCameraEvents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the attendance table and camera event queue current while this panel is open.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh(rangeMode, anchorDate, staffFilter, true);
      void refreshCameraEvents();
    }, 15_000);
    return () => window.clearInterval(intervalId);
    // These callbacks intentionally use the current report controls captured by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMode, anchorDate, staffFilter]);

  function updateForm<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
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
      toast.error("همکار و تاریخ حضور را انتخاب کنید.");
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
      setAnchorDate(form.workDate);
      setRangeMode("day");
      setStaffFilter("all");
      await refresh("day", form.workDate, "all");
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

  function exportCsv() {
    const rows = [
      ["همکار", "سمت", "تاریخ شمسی", "نوبت", "ورود", "خروج", "مجموع حضور", "یادداشت"],
    ];
    for (const record of filteredRecords) {
      const person = staff.find((item) => item.id === record.consultantId);
      record.sessions.forEach((session, index) => {
        rows.push([
          record.consultantName,
          person?.role ?? "",
          formatPersianDate(record.workDate),
          (index + 1).toLocaleString("fa-IR"),
          session.clockIn,
          session.clockOut,
          formatDuration(totalMinutes(record.sessions, record.workDate)),
          record.note,
        ]);
      });
    }
    const csv = "\ufeff" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hirmand-attendance-${currentRange.fromDate}-${currentRange.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("گزارش به‌صورت CSV آماده شد.");
  }

  function setRange(mode: ReportRange) {
    setRangeMode(mode);
    void refresh(mode, anchorDate, staffFilter);
  }

  function setAnchor(value: string) {
    if (!value) return;
    setAnchorDate(value);
    void refresh(rangeMode, value, staffFilter);
  }

  function setFilter(value: string) {
    setStaffFilter(value);
    void refresh(rangeMode, anchorDate, value);
  }

  const isToday = anchorDate === tehranToday();
  const dateTitle = selectedRangeTitle(rangeMode, anchorDate);
  const activeDayPeople = rangeMode === "day" ? reportStats.people : new Set(filteredRecords.filter((r) => r.workDate === anchorDate).map((r) => r.consultantId)).size;
  const averageMinutes = reportStats.people ? Math.round(reportStats.minutes / reportStats.people) : 0;

  return (
    <section className="admin-attendance-manager">
      <style>{ATTENDANCE_CSS}</style>

      <div className="admin-attendance-hero">
        <div className="admin-attendance-hero-main">
          <span className="kicker">مدیریت داخلی • حضور و غیاب</span>
          <h2>ساعت ورود و خروج</h2>
          <p>ثبت چند نوبت حضور، گزارش روزانه تا ماهانه، فیلتر هر همکار و خروجی قابل استفاده برای مدیریت.</p>
        </div>
        <div className="admin-attendance-stat is-accent">
          <strong>{activeDayPeople.toLocaleString("fa-IR")}</strong>
          <span>{isToday ? "نفر ثبت‌شده امروز" : "نفر در روز انتخابی"}</span>
        </div>
        <div className="admin-attendance-stat">
          <strong>{reportStats.records.toLocaleString("fa-IR")}</strong>
          <span>ثبت حضور در بازه</span>
        </div>
        <div className="admin-attendance-stat">
          <strong>{formatDuration(reportStats.minutes)}</strong>
          <span>مجموع ساعات بازه</span>
        </div>
        <div className="admin-attendance-stat">
          <strong>{formatDuration(averageMinutes)}</strong>
          <span>میانگین برای هر نفر</span>
        </div>
      </div>

      <section className="admin-attendance-camera" aria-label="وضعیت ثبت خودکار دوربین">
        <div className="admin-attendance-camera-head">
          <div className="admin-attendance-camera-title">
            <span className="admin-attendance-camera-icon"><Camera size={19} /></span>
            <div>
              <h3>ثبت خودکار ورود و خروج با دوربین</h3>
              <p>رویدادهای دریافتی از پل محلی دفتر در همین گزارش حضور و غیاب ثبت می‌شوند.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={"admin-attendance-camera-status " + (cameraConfigured ? "is-ready" : cameraConfigured === false ? "is-warning" : "")}>
              {cameraConfigured === null ? "در حال بررسی تنظیمات" : cameraConfigured ? "کلید سرور تنظیم شده" : "نیاز به تنظیم کلید"}
            </span>
            <button type="button" className="admin-icon-btn" onClick={() => void refreshCameraEvents()} disabled={cameraLoading} title="تازه‌سازی رویدادهای دوربین" aria-label="تازه‌سازی رویدادهای دوربین">
              <RefreshCw size={15} className={cameraLoading ? "admin-spin" : ""} />
            </button>
          </div>
        </div>
        {cameraConfigured === false ? (
          <p className="admin-attendance-camera-note">برای فعال‌سازی، متغیر سروری ATTENDANCE_CAMERA_SHARED_SECRET را در تنظیمات محیطی Liara تعریف کنید و همان کلید را فقط روی رایانهٔ محلی دفتر قرار دهید. این وضعیت به‌تنهایی اتصال دوربین را تأیید نمی‌کند.</p>
        ) : (
          <p className="admin-attendance-camera-note">تصویر و الگوهای چهره باید روی رایانهٔ داخل دفتر پردازش شوند؛ سرور سایت فقط رویداد و شناسهٔ کارمند را دریافت می‌کند. رویدادهای نامطمئن قبل از اصلاح دستی، ساعت حضور را تغییر نمی‌دهند.</p>
        )}
        {cameraError ? <p className="admin-attendance-camera-note">{cameraError}</p> : null}
        {cameraReviewCount > 0 ? (
          <p className="admin-attendance-camera-note"><AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle" }} /> {cameraReviewCount.toLocaleString("fa-IR")} رویداد در انتظار بررسی یا پردازش است.</p>
        ) : null}
        {cameraEvents.length === 0 ? (
          <div className="admin-attendance-camera-empty">هنوز رویدادی از پل دوربین دریافت نشده است.</div>
        ) : (
          <div className="admin-attendance-camera-events">
            {cameraEvents.slice(0, 8).map((item) => (
              <article className="admin-attendance-camera-event" key={item.eventId}>
                <div>
                  <strong>{item.consultantName}</strong>
                  <div><small>{cameraDirectionLabel(item.direction)} · {cameraEventTime(item.occurredAt)}</small></div>
                </div>
                <div>
                  <small>دوربین: {item.cameraId}</small>
                  <div><small>امتیاز تطبیق: {Number(item.matchScore).toFixed(2)}</small></div>
                </div>
                <small>{item.resultNote || "بدون توضیح"}</small>
                <div style={{ display: "grid", justifyItems: "start", gap: 6 }}>
                  <span className="admin-attendance-camera-event-status">{cameraStatusLabel(item.status)}</span>
                  {item.status === "needs_review" || item.status === "received" ? (
                    <button type="button" className="btn-ghost" style={{ minHeight: 30, padding: "4px 8px", fontSize: ".68rem" }} onClick={() => void markCameraEventReviewed(item)}>
                      بررسی شد
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="admin-attendance-layout">
        <form className="admin-panel admin-attendance-form" onSubmit={submit}>
          <div className="admin-panel-head">
            <div>
              <span className="kicker">{editingId ? "ویرایش ثبت" : "ثبت جدید"}</span>
              <h2>{editingId ? "ویرایش ساعات حضور" : "ثبت حضور همکار"}</h2>
            </div>
            {editingId ? (
              <button type="button" className="admin-icon-btn" onClick={resetForm} title="لغو ویرایش" aria-label="لغو ویرایش">
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

            <div className="field admin-attendance-date-wrap">
              <span>تاریخ حضور</span>
              <PersianDatePicker
                value={form.workDate}
                onChange={(value) => value && updateForm("workDate", value)}
                placeholder="انتخاب تاریخ شمسی"
                hint=""
              />
            </div>

            <div className="field admin-attendance-span">
              <span>نوبت‌های حضور</span>
              <div className="admin-attendance-sessions">
                {form.sessions.map((session, index) => (
                  <div className="admin-attendance-session" key={index}>
                    <span className="admin-attendance-session-label">نوبت {(index + 1).toLocaleString("fa-IR")}</span>
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
                هر نفر می‌تواند چند نوبت در یک روز داشته باشد؛ مثلاً ۰۹:۰۰–۱۳:۰۰ و ۱۷:۰۰–۲۱:۰۰.
              </small>
            </div>

            <div className="admin-attendance-total admin-attendance-span">
              <span>مجموع حضور این فرم</span>
              <strong>{formatDuration(totalMinutes(form.sessions, form.workDate))}</strong>
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
            <div className="admin-panel-head" style={{ margin: 0 }}>
              <div>
                <span className="kicker">تقویم و گزارش</span>
                <h2>{dateTitle}</h2>
              </div>
            </div>

            <div className="admin-attendance-range-tabs" role="tablist" aria-label="بازه گزارش">
              {([
                ["day", "روز"],
                ["week", "هفته"],
                ["month", "ماه"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={rangeMode === value ? "is-active" : ""}
                  onClick={() => setRange(value)}
                  aria-selected={rangeMode === value}
                  role="tab"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-attendance-filterbar">
            <label className="field">
              <span>تاریخ مرجع</span>
              <PersianDatePicker value={anchorDate} onChange={(value) => value && setAnchor(value)} hint="" />
            </label>

            <label className="field">
              <span>فیلتر همکار</span>
              <select value={staffFilter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">همه اعضای بنگاه</option>
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-attendance-filterbar-actions">
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setAnchor(tehranToday())}
                title="امروز"
                aria-label="امروز"
              >
                <CalendarDays size={16} />
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => { void refresh(); void refreshCameraEvents(); }} title="تازه‌سازی" aria-label="تازه‌سازی">
                <RefreshCw size={16} className={loading ? "admin-spin" : ""} />
              </button>
              <button type="button" className="admin-icon-btn admin-attendance-print" onClick={exportCsv} title="خروجی CSV" aria-label="خروجی CSV">
                <Download size={16} />
              </button>
              <button type="button" className="admin-icon-btn admin-attendance-print" onClick={() => window.print()} title="چاپ گزارش" aria-label="چاپ گزارش">
                <Printer size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-attendance-empty">
              <RefreshCw size={24} className="admin-spin" />
              <strong>در حال دریافت گزارش…</strong>
              <span>اطلاعات حضور از PostgreSQL خوانده می‌شود.</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="admin-attendance-empty">
              <Clock3 size={26} />
              <strong>برای این بازه ثبت حضوری پیدا نشد.</strong>
              <span>تاریخ یا فیلتر همکار را تغییر دهید یا از فرم ثبت، حضور جدید وارد کنید.</span>
            </div>
          ) : (
            <div className="admin-attendance-list">
              {filteredRecords.map((record) => {
                const person = staff.find((item) => item.id === record.consultantId);
                return (
                  <article className="admin-attendance-record" key={record.id}>
                    <div className="admin-attendance-person">
                      <span className="admin-attendance-person-icon"><UserRound size={17} /></span>
                      <div>
                        <strong>{record.consultantName}</strong>
                        <small>{person?.role ?? record.consultantId}</small>
                      </div>
                    </div>
                    <div className="admin-attendance-record-main">
                      <div className="admin-attendance-date">{faDate(record.workDate)}</div>
                      <div className="admin-attendance-pills">
                        {record.sessions.map((session, index) => (
                          <span className="admin-attendance-pill" key={index}>
                            <Clock3 size={12} /> نوبت {(index + 1).toLocaleString("fa-IR")}:{" "}
                            {session.clockOut ? <b dir="ltr">{session.clockIn} تا {session.clockOut}</b> : <b>در حال حضور</b>}
                          </span>
                        ))}
                      </div>
                      {record.note ? <small className="admin-attendance-hint">{record.note}</small> : null}
                    </div>
                    <div className="admin-attendance-record-actions">
                      <strong className="admin-attendance-record-total" title="مجموع حضور">
                        {formatDuration(totalMinutes(record.sessions, record.workDate))}
                      </strong>
                      <button type="button" className="admin-icon-btn" onClick={() => edit(record)} title="ویرایش" aria-label="ویرایش">
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="admin-icon-btn" onClick={() => void remove(record)} title="حذف" aria-label="حذف">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="admin-panel admin-attendance-report">
          <div className="admin-attendance-report-head">
            <div>
              <span className="kicker">خلاصه مدیریتی</span>
              <h3>گزارش {dateTitle}</h3>
            </div>
            <button type="button" className="btn-ghost" onClick={exportCsv}>
              <Download size={15} /> خروجی CSV
            </button>
          </div>

          <div className="admin-attendance-report-grid">
            <div className="admin-attendance-report-card">
              <strong>{reportStats.people.toLocaleString("fa-IR")}</strong>
              <span>تعداد همکاران دارای ثبت</span>
            </div>
            <div className="admin-attendance-report-card">
              <strong>{reportStats.activeDays.toLocaleString("fa-IR")}</strong>
              <span>روز دارای سابقه</span>
            </div>
            <div className="admin-attendance-report-card">
              <strong>{reportStats.sessions.toLocaleString("fa-IR")}</strong>
              <span>نوبت‌های ورود و خروج</span>
            </div>
            <div className="admin-attendance-report-card">
              <strong>{formatDuration(reportStats.minutes)}</strong>
              <span>کل زمان حضور</span>
            </div>
          </div>

          <div className="admin-attendance-staff-breakdown">
            {staffBreakdown.length === 0 ? null : (
              <>
                <div className="admin-attendance-staff-row" style={{ background: "var(--card-2)" }}>
                  <strong>همکار</strong>
                  <span>روزهای ثبت</span>
                  <span>ثبت‌ها</span>
                  <b>مجموع ساعات</b>
                </div>
                {staffBreakdown.map((item) => (
                  <div className="admin-attendance-staff-row" key={item.name + item.role}>
                    <div>
                      <strong>{item.name}</strong>
                      <div className="admin-attendance-progress" aria-hidden="true">
                        <span style={{ width: `${Math.round((item.minutes / peakMinutes) * 100)}%` }} />
                      </div>
                    </div>
                    <span>{item.days.toLocaleString("fa-IR")} روز</span>
                    <span>{item.records.toLocaleString("fa-IR")} ثبت</span>
                    <b>{formatDuration(item.minutes)}</b>
                  </div>
                ))}
              </>
            )}
          </div>

          <small className="admin-attendance-hint">
            تاریخ‌ها در ذخیره‌سازی به‌صورت استاندارد نگهداری می‌شوند، اما تمام نمایش و انتخاب تاریخ در این بخش با تقویم شمسی انجام می‌شود.
          </small>
        </section>
      </div>
    </section>
  );
}
