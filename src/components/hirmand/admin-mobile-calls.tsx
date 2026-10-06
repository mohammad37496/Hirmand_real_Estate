import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Headphones,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import "@/admin-mobile-management.css";

type AuthState = "checking" | "authenticated" | "unauthenticated";

type CallItem = {
  id: string;
  deviceId: string;
  deviceName: string;
  phoneNumber: string | null;
  direction: "incoming" | "outgoing" | "missed" | "rejected" | "blocked" | "other";
  directionLabel: string;
  occurredAt: string | null;
  durationSeconds: number | null;
};

type RecordingItem = {
  id: string;
  deviceId: string;
  deviceName: string;
  callStartedAt: string | null;
  callEndedAt: string | null;
  direction: "incoming" | "outgoing" | "unknown";
  phoneNumber: string | null;
  contactName: string | null;
  durationSeconds: number | null;
  mimeType: string;
  sizeBytes: number;
  streamUrl: string;
  downloadUrl: string;
};

type CallsResponse = {
  success: boolean;
  generatedAt: string;
  calls: CallItem[];
  recordings: RecordingItem[];
  counts: {
    calls: number;
    recordings: number;
    incoming: number;
    outgoing: number;
    missed: number;
  };
};

async function readSession(): Promise<AuthState> {
  try {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "login" }),
    });
    const data = (await response.json().catch(() => null)) as { authenticated?: boolean } | null;
    return response.ok && data?.authenticated ? "authenticated" : "unauthenticated";
  } catch {
    return "unauthenticated";
  }
}

async function fetchCalls(): Promise<CallsResponse> {
  const response = await fetch("/api/admin/mobile-management/calls?limit=500", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as CallsResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error("دریافت تماس‌های سازمانی انجام نشد.");
  }
  return data;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes
    ? `${minutes.toLocaleString("fa-IR")}د ${rest.toString().padStart(2, "0")}ث`
    : `${rest.toLocaleString("fa-IR")} ثانیه`;
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function directionIcon(direction: CallItem["direction"]) {
  if (direction === "incoming") return <PhoneIncoming size={16} />;
  if (direction === "outgoing") return <PhoneOutgoing size={16} />;
  if (direction === "missed") return <PhoneMissed size={16} />;
  return <PhoneCall size={16} />;
}

function directionTone(direction: CallItem["direction"]) {
  if (direction === "incoming") return "is-incoming";
  if (direction === "outgoing") return "is-outgoing";
  if (direction === "missed") return "is-missed";
  return "is-other";
}

function AccessGate({ checking = false }: { checking?: boolean }) {
  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell admin-mobile-centered">
        <section className="admin-mobile-panel admin-mobile-access-card">
          <div className="admin-mobile-brand-mark" aria-hidden="true">
            {checking ? <PhoneCall size={25} /> : <ShieldCheck size={25} />}
          </div>
          <span className="admin-mobile-kicker">پنل داخلی هیرمند</span>
          <h1>{checking ? "در حال بررسی نشست مدیریت" : "دسترسی به مرکز تماس"}</h1>
          <p>
            {checking
              ? "اعتبار نشست مدیریت بررسی می‌شود…"
              : "این صفحه فقط برای مدیر مجاز امنیت سیستم قابل مشاهده است."}
          </p>
          {!checking ? (
            <Link to="/admin-mobile-management" className="admin-mobile-primary-action">
              <ArrowRight size={17} />
              بازگشت به مدیریت تلفن همراه
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function AdminMobileCallsPage() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [data, setData] = useState<CallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await readSession();
      setAuth(session);
      if (session !== "authenticated") return;
      setData(await fetchCalls());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بارگذاری مرکز تماس ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const allDevices = useMemo(() => {
    const map = new Map<string, string>();
    data?.calls.forEach((item) => map.set(item.deviceId, item.deviceName));
    data?.recordings.forEach((item) => map.set(item.deviceId, item.deviceName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "fa"));
  }, [data]);

  const calls = useMemo(() => {
    const rows = data?.calls ?? [];
    const unique = new Map<string, CallItem>();
    rows.forEach((item) => unique.set(item.id, item));
    const needle = search.trim().toLowerCase();
    return [...unique.values()].filter((item) => {
      if (deviceFilter !== "all" && item.deviceId !== deviceFilter) return false;
      if (directionFilter !== "all" && item.direction !== directionFilter) return false;
      if (!needle) return true;
      return [item.phoneNumber, item.deviceName, item.directionLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, deviceFilter, directionFilter, search]);

  const recordings = useMemo(() => {
    const rows = data?.recordings ?? [];
    const unique = new Map<string, RecordingItem>();
    rows.forEach((item) => unique.set(item.id, item));
    const needle = search.trim().toLowerCase();
    return [...unique.values()].filter((item) => {
      if (deviceFilter !== "all" && item.deviceId !== deviceFilter) return false;
      if (directionFilter !== "all" && item.direction !== directionFilter && directionFilter !== "all") return false;
      if (!needle) return true;
      return [item.phoneNumber, item.contactName, item.deviceName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, deviceFilter, directionFilter, search]);

  if (auth === "checking" && loading) return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <header className="admin-mobile-header">
          <div className="admin-mobile-header-copy">
            <div className="admin-mobile-header-kicker">
              <span className="admin-mobile-kicker">Call Center</span>
              <span className="admin-mobile-live-dot"><span /> مرکز داخلی</span>
            </div>
            <h1>تماس‌ها</h1>
            <p>
              تاریخچهٔ تماس‌های گوشی‌های سازمانی و فایل‌های ضبط‌شده‌ای که دستگاه واقعاً
              ارسال کرده است، با کنترل دسترسی و رضایت فعال.
            </p>
          </div>
          <div className="admin-mobile-header-actions">
            <Link to="/admin-mobile-management" className="admin-mobile-secondary-action">
              <ArrowRight size={15} />
              مدیریت دستگاه‌ها
            </Link>
            <button type="button" className="admin-mobile-primary-action" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} className={loading ? "admin-mobile-spin" : undefined} />
              بروزرسانی
            </button>
          </div>
        </header>

        {error ? (
          <div className="admin-mobile-error">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="admin-mobile-panel admin-mobile-call-center-note">
          <div className="admin-mobile-call-center-note-icon"><Headphones size={19} /></div>
          <div>
            <strong>پخش آنلاین فایل ضبط‌شده</strong>
            <p>
              دکمهٔ پخش، فایل صوتی ذخیره‌شده روی سرور را مستقیم در مرورگر پخش می‌کند.
              شنیدن زندهٔ یک تماس سلولار در این نسخه ارائه نمی‌شود.
            </p>
          </div>
        </section>

        <section className="admin-mobile-kpi-grid">
          <div className="admin-mobile-kpi-card"><div className="admin-mobile-kpi-icon"><Phone size={19} /></div><span>کل تماس‌ها</span><strong>{data?.counts.calls ?? 0}</strong><small>از دادهٔ همگام‌شدهٔ گوشی‌ها</small></div>
          <div className="admin-mobile-kpi-card" data-tone="success"><div className="admin-mobile-kpi-icon"><PhoneIncoming size={19} /></div><span>دریافتی</span><strong>{data?.counts.incoming ?? 0}</strong><small>تماس‌های ورودی</small></div>
          <div className="admin-mobile-kpi-card"><div className="admin-mobile-kpi-icon"><PhoneOutgoing size={19} /></div><span>گرفته‌شده</span><strong>{data?.counts.outgoing ?? 0}</strong><small>تماس‌های خروجی</small></div>
          <div className="admin-mobile-kpi-card" data-tone="warning"><div className="admin-mobile-kpi-icon"><PhoneMissed size={19} /></div><span>بی‌پاسخ</span><strong>{data?.counts.missed ?? 0}</strong><small>تماس‌های missed</small></div>
          <div className="admin-mobile-kpi-card"><div className="admin-mobile-kpi-icon"><Headphones size={19} /></div><span>فایل ضبط</span><strong>{data?.counts.recordings ?? 0}</strong><small>قابل پخش / دانلود</small></div>
        </section>

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">Filters</span>
              <h2>فیلتر تماس‌ها</h2>
            </div>
            <span className="admin-mobile-count">{calls.length.toLocaleString("fa-IR")} مورد</span>
          </div>

          <div className="admin-mobile-call-filters">
            <input
              className="admin-mobile-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو با شماره یا نام گوشی…"
              dir="auto"
            />
            <select className="admin-mobile-select" value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
              <option value="all">همهٔ گوشی‌ها</option>
              {allDevices.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
            <select className="admin-mobile-select" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
              <option value="all">همهٔ جهت‌ها</option>
              <option value="incoming">دریافتی</option>
              <option value="outgoing">گرفته‌شده</option>
              <option value="missed">بی‌پاسخ</option>
            </select>
          </div>

          {loading && !data ? (
            <div className="admin-mobile-live-location-loading">در حال دریافت تماس‌ها…</div>
          ) : calls.length ? (
            <div className="admin-mobile-call-list">
              {calls.map((call) => (
                <article className="admin-mobile-call-row" key={call.id}>
                  <div className={"admin-mobile-call-direction " + directionTone(call.direction)}>
                    {directionIcon(call.direction)}
                  </div>
                  <div className="admin-mobile-call-main">
                    <div className="admin-mobile-call-title">
                      <strong>{call.phoneNumber || "شمارهٔ نامشخص"}</strong>
                      <span>{call.directionLabel}</span>
                    </div>
                    <div className="admin-mobile-call-meta">
                      <span><UserRound size={13} /> {call.deviceName}</span>
                      <span><Clock3 size={13} /> {formatDateTime(call.occurredAt)}</span>
                      <span>مدت {formatDuration(call.durationSeconds)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-mobile-empty-state">
              <PhoneCall size={22} />
              <strong>تماسی برای نمایش پیدا نشد.</strong>
              <span>دستگاه باید ماژول تماس را با رضایت فعال همگام‌سازی کرده باشد.</span>
            </div>
          )}
        </section>

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">Call Recordings</span>
              <h2>فایل‌های ضبط تماس</h2>
            </div>
            <span className="admin-mobile-count">{recordings.length.toLocaleString("fa-IR")} فایل</span>
          </div>

          {recordings.length ? (
            <div className="admin-mobile-recording-list">
              {recordings.map((recording) => {
                const open = selectedRecording === recording.id;
                return (
                  <article className="admin-mobile-recording-row" key={recording.id}>
                    <div className="admin-mobile-recording-icon"><Headphones size={18} /></div>
                    <div className="admin-mobile-recording-main">
                      <div className="admin-mobile-call-title">
                        <strong>{recording.contactName || recording.phoneNumber || "تماس بدون نام"}</strong>
                        <span>{recording.direction === "incoming" ? "دریافتی" : recording.direction === "outgoing" ? "گرفته‌شده" : "نامشخص"}</span>
                      </div>
                      <div className="admin-mobile-call-meta">
                        <span><UserRound size={13} /> {recording.deviceName}</span>
                        <span><Clock3 size={13} /> {formatDateTime(recording.callStartedAt)}</span>
                        <span>مدت {formatDuration(recording.durationSeconds)}</span>
                        <span>{formatSize(recording.sizeBytes)}</span>
                      </div>

                      {open ? (
                        <div className="admin-mobile-recording-player">
                          <audio controls preload="metadata" src={recording.streamUrl} />
                        </div>
                      ) : null}
                    </div>

                    <div className="admin-mobile-recording-actions">
                      <button
                        type="button"
                        className="admin-mobile-device-action admin-mobile-device-action-primary"
                        onClick={() => setSelectedRecording(open ? null : recording.id)}
                      >
                        <Headphones size={14} />
                        {open ? "بستن پخش" : "پخش آنلاین"}
                      </button>
                      <a className="admin-mobile-device-action" href={recording.downloadUrl}>
                        <Download size={14} />
                        دانلود
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-mobile-empty-state">
              <CheckCircle2 size={22} />
              <strong>هنوز فایل ضبط قابل نمایش وجود ندارد.</strong>
              <span>
                فقط فایل‌هایی که توسط Phone Bridge به سرور ارسال شده‌اند و رضایت فعلی ضبط تماس
                برای دستگاه برقرار است، نمایش داده می‌شوند.
              </span>
            </div>
          )}
        </section>

        <div className="admin-mobile-mini-note">
          <ShieldCheck size={14} />
          نمایش تماس‌ها و فایل‌های ضبط فقط برای حساب دارای <bdi dir="ltr">security.manage</bdi> انجام می‌شود و دسترسی مستقیم به فایل ضبط نیز رضایت فعال و policy دستگاه را دوباره بررسی می‌کند.
        </div>
      </div>
    </main>
  );
}
