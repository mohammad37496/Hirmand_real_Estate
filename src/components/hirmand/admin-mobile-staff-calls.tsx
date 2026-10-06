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
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";

type AuthState = "checking" | "authenticated" | "unauthenticated";

type CallItem = {
  id: string;
  deviceId: string;
  staffId: string;
  staffName: string;
  deviceName: string;
  phoneNumber: string | null;
  contactName: string | null;
  direction: string;
  directionLabel: string;
  occurredAt: string | null;
  durationSeconds: number;
};

type RecordingItem = {
  id: string;
  deviceId: string;
  staffId: string;
  staffName: string;
  deviceName: string;
  callStartedAt: string | null;
  callEndedAt: string | null;
  direction: "incoming" | "outgoing" | "unknown";
  phoneNumber: string | null;
  contactName: string | null;
  durationSeconds: number;
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

async function readAdminSession(): Promise<AuthState> {
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
  const response = await fetch("/api/admin/mobile-management/staff-calls?limit=500", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as CallsResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error("دریافت تماس‌های کارکنان ناموفق بود.");
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

function formatDuration(value: number) {
  const total = Math.max(0, Math.trunc(Number(value) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes} دقیقه و ${seconds} ثانیه` : `${seconds} ثانیه`;
}

function formatSize(value: number) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function directionIcon(direction: string) {
  switch (direction) {
    case "incoming":
      return <PhoneIncoming size={18} />;
    case "outgoing":
      return <PhoneOutgoing size={18} />;
    case "missed":
      return <PhoneMissed size={18} />;
    default:
      return <PhoneCall size={18} />;
  }
}

function directionTone(direction: string) {
  if (direction === "incoming") return "success";
  if (direction === "missed") return "warning";
  if (direction === "rejected" || direction === "blocked") return "danger";
  return "neutral";
}

function AccessGate({ checking = false }: { checking?: boolean }) {
  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell admin-mobile-centered">
        <section className="admin-mobile-panel admin-mobile-access-card">
          <div className="admin-mobile-brand-mark" aria-hidden="true">
            {checking ? <Smartphone size={25} /> : <ShieldCheck size={25} />}
          </div>
          <span className="admin-mobile-kicker">مرکز تماس هیرمند</span>
          <h1>{checking ? "در حال بررسی نشست مدیریت" : "دسترسی مجاز نیست"}</h1>
          <p>
            {checking
              ? "اعتبار نشست مدیریت در حال بررسی است."
              : "برای مشاهده تماس‌های سازمانی و فایل‌های ضبط‌شده، حساب مدیر باید مجوز security.manage داشته باشد."}
          </p>
          {!checking ? (
            <a href="/admin-mobile-management" className="admin-mobile-primary-action">
              <ArrowRight size={17} />
              بازگشت به مدیریت تلفن همراه
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function AdminMobileStaffCallsPage() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [data, setData] = useState<CallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readAdminSession().then((next) => {
      if (!cancelled) setAuth(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchCalls();
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطا در دریافت مرکز تماس.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth !== "authenticated") return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [auth, load]);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data?.calls ?? []) map.set(item.staffId, item.staffName);
    for (const item of data?.recordings ?? []) map.set(item.staffId, item.staffName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "fa"));
  }, [data]);

  const visibleCalls = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const unique = new Map<string, CallItem>();
    for (const item of data?.calls ?? []) unique.set(item.id, item);
    return [...unique.values()].filter((item) => {
      if (staffFilter !== "all" && item.staffId !== staffFilter) return false;
      if (directionFilter !== "all" && item.direction !== directionFilter) return false;
      if (!needle) return true;
      return [
        item.phoneNumber,
        item.contactName,
        item.staffName,
        item.deviceName,
        item.directionLabel,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [data, directionFilter, search, staffFilter]);

  const visibleRecordings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.recordings ?? []).filter((item) => {
      if (staffFilter !== "all" && item.staffId !== staffFilter) return false;
      if (directionFilter !== "all" && item.direction !== directionFilter) return false;
      if (!needle) return true;
      return [
        item.phoneNumber,
        item.contactName,
        item.staffName,
        item.deviceName,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [data, directionFilter, search, staffFilter]);

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <header className="admin-mobile-header">
          <div className="admin-mobile-header-copy">
            <div className="admin-mobile-header-kicker">
              <span className="admin-mobile-kicker">Hirmand Staff App · Call Center</span>
              <span className="admin-mobile-live-dot"><span /> مرکز داخلی</span>
            </div>
            <h1>تماس‌ها</h1>
            <p>
              تاریخچه تماس‌های همگام‌سازی‌شده از خودِ اپ «املاک هیرمند» و فایل‌های ضبط‌شدهٔ
              ارسال‌شده توسط همان اپ.
            </p>
          </div>
          <div className="admin-mobile-header-actions">
            <a href="/admin-mobile-management" className="admin-mobile-secondary-action">
              <ArrowRight size={15} />
              مدیریت دستگاه‌ها
            </a>
            <button
              type="button"
              className="admin-mobile-primary-action"
              onClick={() => void load()}
              disabled={loading}
            >
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

        <section className="hirmand-staff-call-note">
          <div className="hirmand-staff-call-note-icon"><ShieldCheck size={20} /></div>
          <div>
            <strong>این مرکز کاملاً مستقل از Phone Bridge است.</strong>
            <p>
              داده تماس از اپ رسمی کارکنان «املاک هیرمند» می‌آید و پخش آنلاین فقط فایل صوتی
              ذخیره‌شده روی سامانه را اجرا می‌کند؛ شنود زندهٔ تماس سلولار در این نسخه وجود ندارد.
            </p>
          </div>
        </section>

        <section className="admin-mobile-kpi-grid">
          <div className="admin-mobile-kpi-card">
            <div className="admin-mobile-kpi-icon"><Phone size={19} /></div>
            <span>کل تماس‌ها</span>
            <strong>{data?.counts.calls ?? 0}</strong>
            <small>همگام‌شده از اپ هیرمند</small>
          </div>
          <div className="admin-mobile-kpi-card" data-tone="success">
            <div className="admin-mobile-kpi-icon"><PhoneIncoming size={19} /></div>
            <span>دریافتی</span>
            <strong>{data?.counts.incoming ?? 0}</strong>
            <small>تماس‌های ورودی</small>
          </div>
          <div className="admin-mobile-kpi-card">
            <div className="admin-mobile-kpi-icon"><PhoneOutgoing size={19} /></div>
            <span>گرفته‌شده</span>
            <strong>{data?.counts.outgoing ?? 0}</strong>
            <small>تماس‌های خروجی</small>
          </div>
          <div className="admin-mobile-kpi-card" data-tone="warning">
            <div className="admin-mobile-kpi-icon"><PhoneMissed size={19} /></div>
            <span>بی‌پاسخ</span>
            <strong>{data?.counts.missed ?? 0}</strong>
            <small>missed</small>
          </div>
          <div className="admin-mobile-kpi-card">
            <div className="admin-mobile-kpi-icon"><Headphones size={19} /></div>
            <span>ضبط‌ها</span>
            <strong>{data?.counts.recordings ?? 0}</strong>
            <small>قابل پخش و دانلود</small>
          </div>
        </section>

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">Filters</span>
              <h2>فیلتر تماس‌ها</h2>
            </div>
            <span className="admin-mobile-count">{visibleCalls.length.toLocaleString("fa-IR")} مورد</span>
          </div>

          <div className="hirmand-staff-call-filters">
            <label className="admin-mobile-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="شماره، نام مخاطب، کارمند یا گوشی…"
                dir="auto"
              />
            </label>
            <select className="admin-mobile-select" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}>
              <option value="all">همه کارکنان</option>
              {staffOptions.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
            </select>
            <select className="admin-mobile-select" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
              <option value="all">همه جهت‌ها</option>
              <option value="incoming">دریافتی</option>
              <option value="outgoing">گرفته‌شده</option>
              <option value="missed">بی‌پاسخ</option>
              <option value="rejected">ردشده</option>
              <option value="blocked">مسدودشده</option>
            </select>
          </div>

          {loading && !data ? (
            <div className="admin-mobile-loading-grid">
              <div className="admin-mobile-skeleton" />
              <div className="admin-mobile-skeleton" />
              <div className="admin-mobile-skeleton" />
            </div>
          ) : visibleCalls.length ? (
            <div className="hirmand-staff-call-list">
              {visibleCalls.map((call) => (
                <article className="hirmand-staff-call-row" key={call.id}>
                  <div className={"hirmand-staff-call-direction is-" + directionTone(call.direction)}>
                    {directionIcon(call.direction)}
                  </div>
                  <div className="hirmand-staff-call-main">
                    <div className="hirmand-staff-call-title">
                      <strong>{call.contactName || call.phoneNumber || "شماره نامشخص"}</strong>
                      <span>{call.directionLabel}</span>
                    </div>
                    <div className="hirmand-staff-call-meta">
                      <span><UserRound size={13} /> {call.staffName}</span>
                      <span><Smartphone size={13} /> {call.deviceName}</span>
                      <span><Clock3 size={13} /> {formatDateTime(call.occurredAt)}</span>
                      <span>مدت {formatDuration(call.durationSeconds)}</span>
                    </div>
                    {call.phoneNumber && call.contactName ? (
                      <small className="hirmand-staff-call-number" dir="ltr">{call.phoneNumber}</small>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-mobile-empty-state">
              <PhoneCall size={22} />
              <strong>تماسی برای نمایش پیدا نشد.</strong>
              <span>مجوز Call Log را روی اپ هیرمند فعال و دستگاه را در پنل تأیید کنید.</span>
            </div>
          )}
        </section>

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">Audio Archive</span>
              <h2>ضبط تماس‌ها</h2>
            </div>
            <span className="admin-mobile-count">{visibleRecordings.length.toLocaleString("fa-IR")} فایل</span>
          </div>

          {visibleRecordings.length ? (
            <div className="hirmand-staff-recording-list">
              {visibleRecordings.map((recording) => {
                const open = selectedRecording === recording.id;
                return (
                  <article className="hirmand-staff-recording-row" key={recording.id}>
                    <div className="hirmand-staff-recording-icon">
                      <Headphones size={18} />
                    </div>
                    <div className="hirmand-staff-recording-main">
                      <div className="hirmand-staff-call-title">
                        <strong>{recording.contactName || recording.phoneNumber || "تماس بدون نام"}</strong>
                        <span>
                          {recording.direction === "incoming"
                            ? "دریافتی"
                            : recording.direction === "outgoing"
                              ? "گرفته‌شده"
                              : "نامشخص"}
                        </span>
                      </div>
                      <div className="hirmand-staff-call-meta">
                        <span><UserRound size={13} /> {recording.staffName}</span>
                        <span><Smartphone size={13} /> {recording.deviceName}</span>
                        <span><Clock3 size={13} /> {formatDateTime(recording.callStartedAt)}</span>
                        <span>مدت {formatDuration(recording.durationSeconds)}</span>
                        <span>{formatSize(recording.sizeBytes)}</span>
                      </div>

                      {open ? (
                        <div className="hirmand-staff-audio-player">
                          <audio controls preload="metadata" src={recording.streamUrl} />
                        </div>
                      ) : null}
                    </div>

                    <div className="hirmand-staff-recording-actions">
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
              <strong>هنوز فایل ضبطی ثبت نشده است.</strong>
              <span>
                ضبط فقط وقتی ارسال می‌شود که در اپ هیرمند ضبط تماس فعال باشد و Android امکان
                شروع سرویس ضبط را روی همان دستگاه اجازه بدهد.
              </span>
            </div>
          )}
        </section>

        <div className="admin-mobile-mini-note">
          <ShieldCheck size={14} />
          دسترسی به این صفحه و فایل‌های صوتی فقط برای حساب دارای <bdi dir="ltr">security.manage</bdi> است و هر پخش یا دانلود در گزارش ممیزی ثبت می‌شود.
        </div>
      </div>
    </main>
  );
}
