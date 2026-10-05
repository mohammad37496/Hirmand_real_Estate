import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SITE, TEAM } from "@/lib/site";
import "@/admin-mobile-management.css";

type AuthState = "checking" | "authenticated" | "unauthenticated";

type StaffDirectoryItem = {
  id: string;
  name: string;
  role: string;
};

type MobileDevice = {
  id: string;
  deviceId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  status: "pending" | "active" | "revoked" | string;
  appVersionName: string;
  appVersionCode: number;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
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

async function fetchStaffDirectory(): Promise<StaffDirectoryItem[]> {
  const response = await fetch("/api/mobile/staff-directory", { cache: "no-store" });
  const data = (await response.json().catch(() => null)) as
    | { success?: boolean; staff?: StaffDirectoryItem[] }
    | null;

  if (!response.ok || !data?.success || !Array.isArray(data.staff)) {
    throw new Error("دریافت فهرست کارکنان انجام نشد.");
  }

  return data.staff
    .map((item) => ({
      id: String(item.id ?? "").trim(),
      name: String(item.name ?? "").trim(),
      role: String(item.role ?? "").trim(),
    }))
    .filter((item) => item.id && item.name && item.role);
}

async function fetchMobileDevices(): Promise<MobileDevice[]> {
  const response = await fetch("/api/admin/mobile-devices", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { success?: boolean; devices?: MobileDevice[] }
    | null;

  if (!response.ok || !data?.success || !Array.isArray(data.devices)) {
    throw new Error("دریافت فهرست دستگاه‌ها انجام نشد.");
  }

  return data.devices;
}

function fallbackStaffDirectory(): StaffDirectoryItem[] {
  return TEAM.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
  }));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(value));
}

function deviceStatusLabel(status: string) {
  if (status === "active") return "تأییدشده";
  if (status === "pending") return "در انتظار تأیید";
  if (status === "revoked") return "لغوشده";
  return status || "نامشخص";
}

function useAdminAccess() {
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    let cancelled = false;
    void readAdminSession().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function AccessGate({ checking = false }: { checking?: boolean }) {
  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell admin-mobile-centered">
        <section className="admin-mobile-panel admin-mobile-access-card">
          <div className="admin-mobile-brand-mark" aria-hidden="true">
            {checking ? <Smartphone size={25} /> : <LockKeyhole size={25} />}
          </div>
          <span className="admin-mobile-kicker">پنل داخلی هیرمند</span>
          <h1>{checking ? "در حال بررسی نشست مدیریت" : "دسترسی به مدیریت تلفن همراه"}</h1>
          <p>
            {checking
              ? "اعتبار نشست مدیریت بررسی می‌شود…"
              : "برای ورود به این بخش، ابتدا وارد پنل مدیریت هیرمند شوید."}
          </p>
          {!checking ? (
            <Link to="/admin" className="admin-mobile-primary-action">
              <ArrowRight size={17} />
              بازگشت به ورود مدیریت
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="admin-mobile-header">
      <div className="admin-mobile-header-copy">
        <span className="admin-mobile-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-mobile-header-icon" aria-hidden="true">
        <Smartphone size={28} />
      </div>
    </header>
  );
}

function EmployeeCard({ person }: { person: StaffDirectoryItem }) {
  return (
    <Link
      to="/admin-mobile-management/$employeeId"
      params={{ employeeId: person.id }}
      className="admin-mobile-employee-card"
    >
      <div className="admin-mobile-avatar" aria-hidden="true">
        <UserRound size={25} />
      </div>
      <div className="admin-mobile-employee-copy">
        <span className="admin-mobile-employee-role">{person.role}</span>
        <strong>{person.name}</strong>
        <span>
          شناسه: <bdi dir="ltr">{person.id}</bdi>
        </span>
      </div>
      <div className="admin-mobile-card-arrow" aria-hidden="true">
        <ChevronLeft size={20} />
      </div>
    </Link>
  );
}

function DeviceRegistryPanel() {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyDeviceId, setBusyDeviceId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDevices(await fetchMobileDevices());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت فهرست دستگاه‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeStatus = async (deviceId: string, nextAction: "approve" | "revoke") => {
    setBusyDeviceId(deviceId);
    setError("");
    try {
      const response = await fetch("/api/admin/mobile-devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: nextAction, deviceId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; status?: string; message?: string }
        | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "عملیات روی دستگاه انجام نشد.");
      }

      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "عملیات روی دستگاه ناموفق بود.");
    } finally {
      setBusyDeviceId("");
    }
  };

  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head">
        <div>
          <span className="admin-mobile-section-kicker">ثبت دستگاه</span>
          <h2>دستگاه‌های متصل به کارکنان</h2>
        </div>
        <button className="admin-mobile-icon-button" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "admin-mobile-spin" : undefined} />
          به‌روزرسانی
        </button>
      </div>

      <div className="admin-mobile-selection-note">
        <ShieldCheck size={18} />
        <span>
          دستگاه تازه ابتدا با وضعیت «در انتظار تأیید» ثبت می‌شود. فقط مدیر دارای مجوز امنیتی می‌تواند آن را فعال یا لغو کند.
        </span>
      </div>

      {error ? <div className="admin-mobile-error">{error}</div> : null}

      {loading && !devices.length ? (
        <div className="admin-mobile-empty-state">در حال دریافت فهرست دستگاه‌ها…</div>
      ) : devices.length ? (
        <div className="admin-mobile-device-list">
          {devices.map((device) => (
            <article key={device.id} className="admin-mobile-device-card">
              <div className="admin-mobile-device-main">
                <div className="admin-mobile-avatar" aria-hidden="true">
                  <Smartphone size={23} />
                </div>
                <div className="admin-mobile-device-copy">
                  <div className="admin-mobile-device-title-row">
                    <strong>{device.staffName}</strong>
                    <span className={"admin-mobile-status admin-mobile-status-" + device.status}>
                      {device.status === "active" ? <CheckCircle2 size={13} /> : device.status === "pending" ? <Clock3 size={13} /> : <Ban size={13} />}
                      {deviceStatusLabel(device.status)}
                    </span>
                  </div>
                  <span>{device.staffRole || "کارمند"}</span>
                  <bdi dir="ltr" className="admin-mobile-device-id">{device.deviceId}</bdi>
                  <small>
                    نسخه {device.appVersionName || "—"} · آخرین فعالیت {formatDateTime(device.lastSeenAt)}
                  </small>
                </div>
              </div>

              <div className="admin-mobile-device-actions">
                {device.status !== "active" ? (
                  <button
                    type="button"
                    className="admin-mobile-device-action admin-mobile-device-action-primary"
                    disabled={busyDeviceId === device.deviceId}
                    onClick={() => void changeStatus(device.deviceId, "approve")}
                  >
                    <CheckCircle2 size={15} />
                    تأیید دستگاه
                  </button>
                ) : null}

                {device.status !== "revoked" ? (
                  <button
                    type="button"
                    className="admin-mobile-device-action"
                    disabled={busyDeviceId === device.deviceId}
                    onClick={() => void changeStatus(device.deviceId, "revoke")}
                  >
                    <Ban size={15} />
                    لغو دسترسی
                  </button>
                ) : null}
              </div>

              <div className="admin-mobile-device-meta">
                <span>ثبت: {formatDateTime(device.createdAt)}</span>
                <span>به‌روزرسانی: {formatDateTime(device.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-mobile-empty-state">هنوز هیچ دستگاهی برای کارکنان ثبت نشده است.</div>
      )}
    </section>
  );
}

export function AdminMobileManagementPage() {
  const auth = useAdminAccess();
  const [staff, setStaff] = useState<StaffDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchStaffDirectory()
      .then((rows) => {
        if (!cancelled) setStaff(rows);
      })
      .catch((cause) => {
        if (!cancelled) {
          setStaff(fallbackStaffDirectory());
          setError(cause instanceof Error ? cause.message : "فهرست کارکنان از سامانه دریافت نشد.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <PageHeader
          eyebrow="مدیریت داخلی"
          title="مدیریت تلفن همراه"
          description="کارمند را از فهرست زندهٔ سامانه انتخاب کنید و وضعیت دستگاه‌های ثبت‌شده را از همین بخش مدیریت کنید."
        />

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">کارکنان</span>
              <h2>انتخاب کارمند بنگاه</h2>
            </div>
            <span className="admin-mobile-count">
              {loading ? "در حال دریافت…" : staff.length.toLocaleString("fa-IR") + " نفر"}
            </span>
          </div>

          <div className="admin-mobile-selection-note">
            <CheckCircle2 size={18} />
            <span>
              این فهرست از کارکنان فعال سامانهٔ هیرمند می‌آید؛ بنابراین اضافه‌کردن کارمند جدید در سایت، بدون ساخت APK جدید هم قابل مشاهده است.
            </span>
          </div>

          {error ? <div className="admin-mobile-soft-warning">{error}</div> : null}

          <div className="admin-mobile-employee-grid">
            {staff.map((person) => (
              <EmployeeCard key={person.id} person={person} />
            ))}
          </div>
        </section>

        <DeviceRegistryPanel />

        <div className="admin-mobile-footer-links">
          <Link to="/admin" className="admin-mobile-secondary-action">
            <ArrowRight size={16} />
            بازگشت به پنل مدیریت
          </Link>
          <span>{SITE.nameFa}</span>
        </div>
      </div>
    </main>
  );
}

export function AdminMobileEmployeePage({ employeeId }: { employeeId: string }) {
  const auth = useAdminAccess();
  const [staff, setStaff] = useState<StaffDirectoryItem[]>([]);
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const person = useMemo(
    () => staff.find((item) => item.id.trim().toLowerCase() === employeeId.trim().toLowerCase()) ?? null,
    [staff, employeeId],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchStaffDirectory(), fetchMobileDevices()])
      .then(([staffRows, deviceRows]) => {
        if (!cancelled) {
          setStaff(staffRows);
          setDevices(deviceRows);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setStaff(fallbackStaffDirectory());
          setError(cause instanceof Error ? cause.message : "دریافت اطلاعات انجام نشد.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const personDevices = useMemo(
    () => devices.filter((device) => device.staffId.trim().toLowerCase() === employeeId.trim().toLowerCase()),
    [devices, employeeId],
  );

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  if (loading && !person) {
    return (
      <main className="admin-mobile-page">
        <div className="admin-mobile-shell admin-mobile-centered">
          <section className="admin-mobile-panel admin-mobile-empty-card">
            <span className="admin-mobile-kicker">کارمند</span>
            <h1>در حال دریافت اطلاعات</h1>
            <p>فهرست کارکنان و دستگاه‌های ثبت‌شده در حال بارگذاری است…</p>
          </section>
        </div>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="admin-mobile-page">
        <div className="admin-mobile-shell admin-mobile-centered">
          <section className="admin-mobile-panel admin-mobile-empty-card">
            <span className="admin-mobile-kicker">کارمند</span>
            <h1>کارمند پیدا نشد</h1>
            <p>{error || "کارمند انتخاب‌شده در فهرست فعلی هیرمند وجود ندارد."}</p>
            <Link to="/admin-mobile-management" className="admin-mobile-primary-action">
              <ArrowRight size={17} />
              بازگشت به کارکنان
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <div className="admin-mobile-breadcrumbs">
          <Link to="/admin-mobile-management">مدیریت تلفن همراه</Link>
          <ChevronLeft size={14} aria-hidden="true" />
          <span>{person.name}</span>
        </div>

        <PageHeader
          eyebrow={person.role}
          title={person.name}
          description="وضعیت گوشی‌های ثبت‌شده برای این کارمند را ببینید. فعال‌شدن دستگاه نیازمند تأیید مدیریت است."
        />

        <section className="admin-mobile-panel">
          <div className="admin-mobile-person-hero">
            <div className="admin-mobile-avatar admin-mobile-avatar-large" aria-hidden="true">
              <UserRound size={34} />
            </div>
            <div>
              <span className="admin-mobile-section-kicker">کارمند انتخاب‌شده</span>
              <h2>{person.name}</h2>
              <p>{person.role} · <bdi dir="ltr">{person.id}</bdi></p>
            </div>
          </div>

          <div className="admin-mobile-placeholder-grid">
            <div className="admin-mobile-placeholder-card">
              <Smartphone size={20} />
              <strong>تعداد دستگاه‌ها</strong>
              <span>{personDevices.length.toLocaleString("fa-IR")} دستگاه ثبت‌شده</span>
            </div>
            <div className="admin-mobile-placeholder-card">
              <ShieldCheck size={20} />
              <strong>وضعیت دسترسی</strong>
              <span>
                {personDevices.some((device) => device.status === "active")
                  ? "حداقل یک دستگاه تأییدشده دارد."
                  : "دستگاه تأییدشده‌ای ندارد."}
              </span>
            </div>
          </div>
        </section>

        {personDevices.length ? (
          <section className="admin-mobile-panel">
            <div className="admin-mobile-section-head">
              <div>
                <span className="admin-mobile-section-kicker">دستگاه‌های این کارمند</span>
                <h2>فهرست دستگاه‌ها</h2>
              </div>
            </div>

            <div className="admin-mobile-device-list">
              {personDevices.map((device) => (
                <article key={device.id} className="admin-mobile-device-card">
                  <div className="admin-mobile-device-main">
                    <div className="admin-mobile-avatar" aria-hidden="true">
                      <Smartphone size={23} />
                    </div>
                    <div className="admin-mobile-device-copy">
                      <div className="admin-mobile-device-title-row">
                        <strong>{deviceStatusLabel(device.status)}</strong>
                        <span className={"admin-mobile-status admin-mobile-status-" + device.status}>
                          {deviceStatusLabel(device.status)}
                        </span>
                      </div>
                      <bdi dir="ltr" className="admin-mobile-device-id">{device.deviceId}</bdi>
                      <small>
                        نسخه {device.appVersionName || "—"} · آخرین فعالیت {formatDateTime(device.lastSeenAt)}
                      </small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="admin-mobile-panel">
            <div className="admin-mobile-empty-state">
              هنوز دستگاهی برای این کارمند ثبت نشده است. پس از انتخاب کارمند در اپ و ثبت آن روی گوشی، دستگاه در اینجا ظاهر می‌شود.
            </div>
          </section>
        )}

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">تغییر انتخاب</span>
              <h2>کارمند دیگری را انتخاب کنید</h2>
            </div>
          </div>
          <div className="admin-mobile-employee-grid admin-mobile-employee-grid-compact">
            {staff.map((item) => (
              <EmployeeCard key={item.id} person={item} />
            ))}
          </div>
        </section>

        <div className="admin-mobile-footer-links">
          <Link to="/admin-mobile-management" className="admin-mobile-secondary-action">
            <ArrowRight size={16} />
            بازگشت به کارکنان
          </Link>
          <Link to="/admin" className="admin-mobile-secondary-action">
            بازگشت به پنل مدیریت
          </Link>
        </div>
      </div>
    </main>
  );
}
