import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Cpu,
  Crosshair,
  DatabaseZap,
  Filter,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listAdminAuditLog } from "@/lib/admin-audit";
import { SITE, TEAM } from "@/lib/site";
import {
  deviceStatusLabel,
  formatRelativeAge,
  managementModeLabel,
  managementModeShortLabel,
  mobilePresenceLabel,
  parseManagementMode,
  type MobileManagementMode,
  type MobilePresence,
} from "@/lib/mobile-management";
import "@/admin-mobile-management.css";

type AuthState = "checking" | "authenticated" | "unauthenticated";

type StaffDirectoryItem = {
  id: string;
  name: string;
  role: string;
};

type PermissionItem = {
  key: string;
  label: string;
  status: "granted" | "denied" | "unknown";
};

type PolicyState = {
  management: string;
  permissions: string;
  sync: string;
  retention: string;
  location: string;
};

type DeviceAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  deviceId: string;
  staffId: string;
};

export type MobileDevice = {
  id: string;
  deviceId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  status: string;
  appVersionName: string;
  appVersionCode: number;
  managementMode: MobileManagementMode;
  managementModeLabel: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkInt: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  latestPermissionAt: string | null;
  latestHeartbeatAt: string | null;
  latestLocationAt: string | null;
  presence: MobilePresence;
  presenceLabel: string;
  permissions: PermissionItem[];
  locationCapability: "available" | "not_active";
  policy: PolicyState;
  alerts: DeviceAlert[];
  needsAttention: boolean;
};

type SummaryResponse = {
  success: boolean;
  generatedAt: string;
  counts: {
    total: number;
    active: number;
    pending: number;
    revoked: number;
    online: number;
    attention: number;
    deviceOwner: number;
    profileOwner: number;
  };
  devices: MobileDevice[];
  alerts: DeviceAlert[];
  policy: {
    managementMode: string;
    permissionPolicy: string;
    securityPolicy: string;
    appPolicy: string;
    syncPolicy: string;
    retentionPolicy: string;
    locationPolicy: string;
  };
};

type TelemetryResponse = {
  success: boolean;
  telemetry: Array<{
    id: string;
    eventType: string;
    payload: unknown;
    observedAt: string | null;
    receivedAt: string | null;
  }>;
  locations: Array<{
    id: string;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    provider: string;
    observedAt: string | null;
    receivedAt: string | null;
  }>;
};

const FALLBACK_STAFF: StaffDirectoryItem[] = TEAM.map((person) => ({
  id: person.id,
  name: person.name,
  role: person.role,
}));

const PRESENCE_FILTERS = new Set(["all", "online", "offline", "stale", "attention"]);

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

async function fetchSummary(): Promise<SummaryResponse> {
  const response = await fetch("/api/admin/mobile-management/summary", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as SummaryResponse | null;
  if (!response.ok || !data?.success || !Array.isArray(data.devices)) {
    throw new Error("دریافت وضعیت ناوگان تلفن همراه انجام نشد.");
  }
  return data;
}

async function fetchTelemetry(deviceId: string): Promise<TelemetryResponse> {
  const params = new URLSearchParams({ deviceId, limit: "80" });
  const response = await fetch("/api/admin/mobile-telemetry?" + params.toString(), {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as TelemetryResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error("داده فعالیت دستگاه دریافت نشد.");
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

function statusTone(value: string) {
  if (value === "active") return "success";
  if (value === "pending") return "warning";
  if (value === "revoked") return "danger";
  return "muted";
}

function presenceTone(value: MobilePresence) {
  if (value === "online") return "success";
  if (value === "stale") return "warning";
  if (value === "offline") return "danger";
  return "muted";
}

function permissionLabel(status: PermissionItem["status"]) {
  if (status === "granted") return "فعال";
  if (status === "denied") return "غیرفعال";
  return "نامشخص";
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
              : "برای مشاهده و مدیریت دستگاه‌ها، با حساب مجاز امنیت سیستم وارد شوید."}
          </p>
          {!checking ? (
            <Link to="/admin" className="admin-mobile-primary-action">
              <ArrowRight size={17} />
              بازگشت به پنل مدیریت
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-mobile-header">
      <div className="admin-mobile-header-copy">
        <div className="admin-mobile-header-kicker">
          <span className="admin-mobile-kicker">{eyebrow}</span>
          <span className="admin-mobile-live-dot"><span /> محیط مدیریتی</span>
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-mobile-header-actions">
        {action}
        <div className="admin-mobile-header-icon" aria-hidden="true">
          <Smartphone size={28} />
        </div>
      </div>
    </header>
  );
}

function KpiCard({
  label,
  value,
  icon,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  meta: string;
  tone?: string;
}) {
  return (
    <article className="admin-mobile-kpi-card" data-tone={tone}>
      <div className="admin-mobile-kpi-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value.toLocaleString("fa-IR")}</strong>
      <small>{meta}</small>
    </article>
  );
}

function ManagementBadge({ mode }: { mode: MobileManagementMode }) {
  return (
    <span className="admin-mobile-badge admin-mobile-badge-neutral" title={managementModeLabel(mode)}>
      <ShieldCheck size={13} />
      {managementModeShortLabel(mode)}
    </span>
  );
}

function PresenceBadge({ device }: { device: MobileDevice }) {
  return (
    <span className={"admin-mobile-badge admin-mobile-badge-" + presenceTone(device.presence)}>
      {device.presence === "online" ? <Wifi size={13} /> : device.presence === "offline" ? <WifiOff size={13} /> : <Clock3 size={13} />}
      {mobilePresenceLabel(device.presence)}
    </span>
  );
}

function DeviceCard({
  device,
  onStatusChange,
  busyDeviceId,
  compact = false,
}: {
  device: MobileDevice;
  onStatusChange: (device: MobileDevice, action: "approve" | "revoke") => void;
  busyDeviceId: string;
  compact?: boolean;
}) {
  const model = [device.manufacturer, device.model].filter(Boolean).join(" ");
  return (
    <article className={"admin-mobile-fleet-card" + (compact ? " is-compact" : "")}>
      <div className="admin-mobile-fleet-main">
        <div className="admin-mobile-device-icon" aria-hidden="true">
          <Smartphone size={23} />
        </div>
        <div className="admin-mobile-fleet-copy">
          <div className="admin-mobile-fleet-top">
            <Link
              to="/admin-mobile-management/$employeeId"
              params={{ employeeId: device.staffId }}
              search={{}}
              className="admin-mobile-device-person"
            >
              {device.staffName || device.staffId}
            </Link>
            <span className={"admin-mobile-badge admin-mobile-badge-" + statusTone(device.status)}>
              {device.status === "active" ? <CheckCircle2 size={13} /> : device.status === "pending" ? <Clock3 size={13} /> : <Ban size={13} />}
              {deviceStatusLabel(device.status)}
            </span>
          </div>
          <div className="admin-mobile-fleet-subline">
            <span>{device.staffRole || "کارمند"}</span>
            <ManagementBadge mode={device.managementMode} />
            <PresenceBadge device={device} />
            {device.needsAttention ? (
              <span className="admin-mobile-badge admin-mobile-badge-warning"><AlertTriangle size={13} /> نیازمند بررسی</span>
            ) : null}
          </div>
          <div className="admin-mobile-fleet-meta">
            <span><b>دستگاه</b> <bdi dir="ltr">{device.deviceId}</bdi></span>
            <span><b>مدل</b> {model || "نامشخص"}</span>
            <span><b>Android</b> {device.androidVersion || "—"}</span>
            <span><b>اپ</b> {device.appVersionName || "—"}</span>
            <span><b>آخرین مشاهده</b> {formatRelativeAge(device.lastSeenAt)}</span>
          </div>
        </div>
        <div className="admin-mobile-fleet-side">
          <Link to="/admin-mobile-management/$employeeId" params={{ employeeId: device.staffId }} search={{}} className="admin-mobile-secondary-action">
            جزئیات
            <ChevronLeft size={15} />
          </Link>
          {!compact && (
            <div className="admin-mobile-fleet-status-actions">
              {device.status !== "active" ? (
                <button
                  type="button"
                  className="admin-mobile-device-action admin-mobile-device-action-primary"
                  disabled={busyDeviceId === device.deviceId}
                  onClick={() => onStatusChange(device, "approve")}
                >
                  <CheckCircle2 size={14} /> تأیید
                </button>
              ) : null}
              {device.status !== "revoked" ? (
                <button
                  type="button"
                  className="admin-mobile-device-action danger"
                  disabled={busyDeviceId === device.deviceId}
                  onClick={() => onStatusChange(device, "revoke")}
                >
                  <Ban size={14} /> لغو
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AlertPanel({ alerts }: { alerts: DeviceAlert[] }) {
  return (
    <section className="admin-mobile-panel admin-mobile-alert-panel">
      <div className="admin-mobile-section-head">
        <div>
          <span className="admin-mobile-section-kicker">Attention Center</span>
          <h2>هشدارها و موارد نیازمند توجه</h2>
        </div>
        <span className="admin-mobile-count">{alerts.length.toLocaleString("fa-IR")} مورد</span>
      </div>
      {alerts.length ? (
        <div className="admin-mobile-alert-list">
          {alerts.slice(0, 10).map((alert) => (
            <article key={alert.id} className={"admin-mobile-alert-row is-" + alert.severity}>
              <div className="admin-mobile-alert-icon" aria-hidden="true">
                {alert.severity === "critical" ? <ShieldAlert size={17} /> : alert.severity === "warning" ? <AlertTriangle size={17} /> : <Info size={17} />}
              </div>
              <div className="admin-mobile-alert-copy">
                <strong>{alert.title}</strong>
                <span>{alert.description}</span>
              </div>
              <Link
                to="/admin-mobile-management/$employeeId"
                params={{ employeeId: alert.staffId }}
                search={{}}
                className="admin-mobile-alert-link"
              >
                مشاهده
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-mobile-empty-state">
          <CheckCircle2 size={22} />
          <strong>مورد باز مهمی ثبت نشده است.</strong>
          <span>هشدارها از وضعیت واقعی دستگاه‌ها و telemetry فعلی ساخته می‌شوند.</span>
        </div>
      )}
    </section>
  );
}

function EnrollmentWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"company" | "personal">("company");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) {
      setMode("company");
      setStep(0);
    }
  }, [open]);

  if (!open) return null;

  const companySteps = [
    {
      title: "گوشی سازمانی را انتخاب کنید",
      body: "این مسیر برای دستگاه متعلق به شرکت است که قرار است Fully Managed / Device Owner باشد.",
    },
    {
      title: "دستگاه را Provision کنید",
      body: "از فرایند رسمی Android Enterprise استفاده کنید. APK معمولی به‌تنهایی Device Owner ایجاد نمی‌کند.",
    },
    {
      title: "پس از Provisioning برنامه را باز کنید",
      body: "اپ هیرمند حالت Device Owner را به‌صورت واقعی تشخیص می‌دهد و metadata آن را در ثبت دستگاه ارسال می‌کند.",
    },
    {
      title: "تأیید مدیریت را انجام دهید",
      body: "دستگاه ابتدا pending است و پس از بررسی مدیر دارای security.manage فعال می‌شود.",
    },
  ];

  const personalSteps = [
    {
      title: "گوشی شخصی را انتخاب کنید",
      body: "این مسیر فقط فضای کاری هیرمند را مدیریت می‌کند و برای جداسازی فضای کاری از پروفایل شخصی طراحی شده است.",
    },
    {
      title: "Work Profile را شروع کنید",
      body: "از جریان رسمی Android Enterprise برای Managed Profile استفاده کنید؛ وضعیت Profile Owner توسط اپ تشخیص داده می‌شود.",
    },
    {
      title: "اپ را داخل فضای کاری اجرا کنید",
      body: "اطلاعات مدیریتی ثبت‌شده مربوط به فضای کاری است. داده‌های شخصی پروفایل اصلی در این پنل جزو اطلاعات دستگاه سازمانی نیست.",
    },
    {
      title: "تأیید مدیریت را انجام دهید",
      body: "ثبت جدید pending است و بعد از تأیید مدیر فعال خواهد شد.",
    },
  ];

  const steps = mode === "company" ? companySteps : personalSteps;
  const item = steps[step];

  return (
    <div className="admin-mobile-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-mobile-modal" role="dialog" aria-modal="true" aria-labelledby="enrollment-title">
        <div className="admin-mobile-modal-head">
          <div>
            <span className="admin-mobile-section-kicker">Enrollment Wizard</span>
            <h2 id="enrollment-title">ثبت دستگاه جدید</h2>
          </div>
          <button type="button" className="admin-mobile-close" onClick={onClose} aria-label="بستن">×</button>
        </div>

        <div className="admin-mobile-enrollment-modes">
          <button type="button" className={mode === "company" ? "is-active" : ""} onClick={() => { setMode("company"); setStep(0); }}>
            <Laptop size={18} />
            <span><strong>گوشی سازمانی</strong><small>Fully Managed / Device Owner</small></span>
          </button>
          <button type="button" className={mode === "personal" ? "is-active" : ""} onClick={() => { setMode("personal"); setStep(0); }}>
            <Smartphone size={18} />
            <span><strong>گوشی شخصی</strong><small>Work Profile / Profile Owner</small></span>
          </button>
        </div>

        <div className="admin-mobile-stepper">
          {steps.map((current, index) => (
            <div key={current.title} className={index <= step ? "is-active" : ""}>
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              <small>{current.title}</small>
            </div>
          ))}
        </div>

        <div className="admin-mobile-enrollment-card">
          <div className="admin-mobile-enrollment-icon"><KeyRound size={20} /></div>
          <div>
            <span>گام {(step + 1).toLocaleString("fa-IR")} از {steps.length.toLocaleString("fa-IR")}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </div>

        <div className="admin-mobile-modal-foot">
          <button type="button" className="admin-mobile-secondary-action" onClick={onClose}>بستن</button>
          <div className="admin-mobile-modal-nav">
            <button type="button" className="admin-mobile-device-action" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>قبلی</button>
            <button type="button" className="admin-mobile-device-action admin-mobile-device-action-primary" disabled={step === steps.length - 1} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>بعدی</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyCenter({ policy }: { policy: SummaryResponse["policy"] }) {
  const items = [
    { label: "Management Mode", value: policy.managementMode, icon: <ShieldCheck size={17} /> },
    { label: "Permission Policy", value: policy.permissionPolicy, icon: <Settings2 size={17} /> },
    { label: "Security Policy", value: policy.securityPolicy, icon: <LockKeyhole size={17} /> },
    { label: "App Policy", value: policy.appPolicy, icon: <Smartphone size={17} /> },
    { label: "Sync Policy", value: policy.syncPolicy, icon: <Wifi size={17} /> },
    { label: "Retention Policy", value: policy.retentionPolicy, icon: <HardDrive size={17} /> },
    { label: "Location Policy", value: policy.locationPolicy, icon: <MapPin size={17} /> },
  ];
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head">
        <div>
          <span className="admin-mobile-section-kicker">Policy Center</span>
          <h2>مرکز سیاست‌های دستگاه</h2>
        </div>
        <Settings2 size={18} />
      </div>
      <div className="admin-mobile-policy-grid">
        {items.map((item) => (
          <article className="admin-mobile-policy-card" key={item.label}>
            <div className="admin-mobile-policy-icon">{item.icon}</div>
            <div>
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </div>
            <em>{item.label === "Location Policy" ? "غیرفعال" : item.label === "App Policy" ? "مشاهده‌ای" : "مبنای واقعی"}</em>
          </article>
        ))}
      </div>
      <div className="admin-mobile-policy-note">
        <Info size={16} />
        <span>این مرکز فقط قابلیت‌هایی را که در کد و داده فعلی اجرایی یا واقعاً قابل مشاهده‌اند operational نشان می‌دهد. policyهای بدون enforcement ساختگی فعال اعلام نمی‌شوند.</span>
      </div>
    </section>
  );
}

function AuditMiniPanel() {
  const [items, setItems] = useState<Array<Awaited<ReturnType<typeof listAdminAuditLog>>[number]>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void listAdminAuditLog({ data: { limit: 12, entityType: "staff_mobile_device" } })
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head">
        <div>
          <span className="admin-mobile-section-kicker">Audit Trail</span>
          <h2>آخرین عملیات امنیتی</h2>
        </div>
        <Link to="/admin" className="admin-mobile-text-link">مشاهده پنل گزارش</Link>
      </div>
      {loading ? (
        <div className="admin-mobile-empty-state">در حال دریافت گزارش عملیات…</div>
      ) : items.length ? (
        <div className="admin-mobile-audit-list">
          {items.map((item) => (
            <article key={item.id} className="admin-mobile-audit-row">
              <div className="admin-mobile-audit-icon"><ClipboardList size={15} /></div>
              <div>
                <strong>{auditActionLabel(item.action)}</strong>
                <span>{item.entityTitle || "دستگاه موبایل"}</span>
              </div>
              <small>{formatDateTime(item.createdAt)}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-mobile-empty-state">
          <DatabaseZap size={21} />
          <span>هنوز عملیات مدیریتی دستگاهی ثبت نشده است.</span>
        </div>
      )}
    </section>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "staff_mobile_device.approve": "تأیید دستگاه",
    "staff_mobile_device.revoke": "لغو دسترسی",
    "staff_mobile_device.enrollment": "ثبت دستگاه",
    "staff_mobile_device.security": "عملیات امنیتی",
  };
  return labels[action] ?? action;
}

function ConfirmAction({
  device,
  busy,
  onClose,
  onConfirm,
}: {
  device: MobileDevice;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="admin-mobile-modal-backdrop">
      <div className="admin-mobile-modal admin-mobile-confirm-modal" role="dialog" aria-modal="true">
        <div className="admin-mobile-confirm-icon"><Ban size={22} /></div>
        <span className="admin-mobile-section-kicker">عملیات حساس</span>
        <h2>لغو دسترسی دستگاه؟</h2>
        <p>
          دسترسی <bdi dir="ltr">{device.deviceId}</bdi> برای <strong>{device.staffName}</strong> به وضعیت لغوشده منتقل می‌شود. این عملیات در Audit Trail ثبت خواهد شد.
        </p>
        <div className="admin-mobile-modal-foot">
          <button type="button" className="admin-mobile-secondary-action" onClick={onClose}>انصراف</button>
          <button type="button" className="admin-mobile-device-action danger" onClick={onConfirm} disabled={busy}>
            {busy ? <RefreshCw size={14} className="admin-mobile-spin" /> : <Ban size={14} />}
            تأیید لغو
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeCard({ person, deviceCount }: { person: StaffDirectoryItem; deviceCount: number }) {
  return (
    <Link
      to="/admin-mobile-management/$employeeId"
      params={{ employeeId: person.id }}
      search={{}}
      className="admin-mobile-employee-card"
    >
      <div className="admin-mobile-avatar" aria-hidden="true"><UserRound size={22} /></div>
      <div className="admin-mobile-employee-copy">
        <span className="admin-mobile-employee-role">{person.role}</span>
        <strong>{person.name}</strong>
        <span>{deviceCount.toLocaleString("fa-IR")} دستگاه · <bdi dir="ltr">{person.id}</bdi></span>
      </div>
      <ChevronLeft size={18} className="admin-mobile-card-arrow" aria-hidden="true" />
    </Link>
  );
}

function useFleetData(authenticated: boolean) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await fetchSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت وضعیت ناوگان ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void load();
    let cancelled = false;
    void fetchStaffDirectory()
      .then((rows) => { if (!cancelled) setStaff(rows); })
      .catch(() => { if (!cancelled) setStaff(FALLBACK_STAFF); })
      .finally(() => { if (!cancelled) setStaffLoading(false); });
    return () => { cancelled = true; };
  }, [authenticated, load]);

  return { summary, staff, loading, staffLoading, error, load };
}

export function AdminMobileManagementPage() {
  const auth = useAdminAccess();
  const { summary, staff, loading, staffLoading, error, load } = useFleetData(auth === "authenticated");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [presenceFilter, setPresenceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sort, setSort] = useState("attention");
  const [busyDeviceId, setBusyDeviceId] = useState("");
  const [confirmDevice, setConfirmDevice] = useState<MobileDevice | null>(null);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);

  const visibleDevices = useMemo(() => {
    if (!summary) return [];
    const needle = query.trim().toLowerCase();
    return summary.devices
      .filter((device) => {
        if (statusFilter !== "all" && device.status !== statusFilter) return false;
        if (presenceFilter === "attention" && !device.needsAttention) return false;
        if (PRESENCE_FILTERS.has(presenceFilter) && ["online", "offline", "stale"].includes(presenceFilter) && device.presence !== presenceFilter) return false;
        if (modeFilter !== "all" && device.managementMode !== modeFilter) return false;
        if (!needle) return true;
        return [
          device.staffName,
          device.staffRole,
          device.staffId,
          device.deviceId,
          device.model,
          device.manufacturer,
          device.androidVersion,
        ].some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sort === "name") return a.staffName.localeCompare(b.staffName, "fa");
        if (sort === "created") return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
        if (sort === "lastSeen") return String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? ""));
        if (sort === "status") return statusPriority(a.status) - statusPriority(b.status);
        return Number(b.needsAttention) - Number(a.needsAttention) || String(a.staffName).localeCompare(String(b.staffName), "fa");
      });
  }, [summary, query, statusFilter, presenceFilter, modeFilter, sort]);

  async function changeStatus(device: MobileDevice, action: "approve" | "revoke") {
    if (action === "revoke") {
      setConfirmDevice(device);
      return;
    }
    setBusyDeviceId(device.deviceId);
    try {
      const response = await fetch("/api/admin/mobile-devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, deviceId: device.deviceId }),
      });
      const data = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !data?.success) throw new Error(data?.message || "عملیات روی دستگاه انجام نشد.");
      await load();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "عملیات ناموفق بود.");
    } finally {
      setBusyDeviceId("");
    }
  }

  async function confirmRevoke() {
    if (!confirmDevice) return;
    setBusyDeviceId(confirmDevice.deviceId);
    try {
      const response = await fetch("/api/admin/mobile-devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", deviceId: confirmDevice.deviceId }),
      });
      const data = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !data?.success) throw new Error(data?.message || "لغو دسترسی انجام نشد.");
      setConfirmDevice(null);
      await load();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "لغو دسترسی ناموفق بود.");
    } finally {
      setBusyDeviceId("");
    }
  }

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  const counts = summary?.counts ?? { total: 0, active: 0, pending: 0, revoked: 0, online: 0, attention: 0, deviceOwner: 0, profileOwner: 0 };

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <PageHeader
          eyebrow="Mobile Fleet Management"
          title="مرکز مدیریت تلفن همراه"
          description="وضعیت واقعی دستگاه‌های کارکنان، سلامت اتصال، مدیریت Android Enterprise و موارد نیازمند توجه را از یک نقطه مدیریت کنید."
          action={
            <button type="button" className="admin-mobile-primary-action admin-mobile-header-action" onClick={() => setEnrollmentOpen(true)}>
              <Crosshair size={16} /> افزودن دستگاه
            </button>
          }
        />

        {error ? (
          <div className="admin-mobile-error">
            <AlertTriangle size={17} />
            <span>{error}</span>
            <button type="button" className="admin-mobile-icon-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> تلاش دوباره</button>
          </div>
        ) : null}

        <section className="admin-mobile-kpi-grid">
          <KpiCard label="کل دستگاه‌ها" value={counts.total} icon={<Smartphone size={19} />} meta="ثبت‌شده در سامانه" />
          <KpiCard label="فعال" value={counts.active} icon={<CheckCircle2 size={19} />} meta="دسترسی مدیریتی فعال" tone="success" />
          <KpiCard label="در انتظار" value={counts.pending} icon={<Clock3 size={19} />} meta="نیازمند تأیید مدیریت" tone="warning" />
          <KpiCard label="لغوشده" value={counts.revoked} icon={<Ban size={19} />} meta="دسترسی غیرفعال" tone="danger" />
          <KpiCard label="آنلاین" value={counts.online} icon={<Wifi size={19} />} meta="آخرین مشاهده ≤ ۵ دقیقه" tone="success" />
          <KpiCard label="نیازمند توجه" value={counts.attention} icon={<AlertTriangle size={19} />} meta="هشدار واقعی" tone="warning" />
          <KpiCard label="Fully Managed" value={counts.deviceOwner} icon={<Laptop size={19} />} meta="Device Owner" />
          <KpiCard label="Work Profile" value={counts.profileOwner} icon={<ShieldCheck size={19} />} meta="Profile Owner" />
        </section>

        {loading && !summary ? (
          <section className="admin-mobile-panel">
            <div className="admin-mobile-loading-grid">
              {Array.from({ length: 6 }).map((_, index) => <div className="admin-mobile-skeleton" key={index} />)}
            </div>
          </section>
        ) : null}

        {summary ? (
          <>
            <AlertPanel alerts={summary.alerts} />

            <section className="admin-mobile-panel">
              <div className="admin-mobile-section-head admin-mobile-section-head-tight">
                <div>
                  <span className="admin-mobile-section-kicker">Device Registry</span>
                  <h2>ناوگان دستگاه‌های کارکنان</h2>
                </div>
                <div className="admin-mobile-section-head-actions">
                  <span className="admin-mobile-count">{visibleDevices.length.toLocaleString("fa-IR")} دستگاه نمایش داده می‌شود</span>
                  <button className="admin-mobile-icon-button" type="button" onClick={() => void load()} disabled={loading}>
                    <RefreshCw size={15} className={loading ? "admin-mobile-spin" : undefined} /> بروزرسانی
                  </button>
                </div>
              </div>

              <div className="admin-mobile-toolbar">
                <label className="admin-mobile-search">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام کارمند، شناسه دستگاه، مدل یا نقش…" />
                </label>
                <label className="admin-mobile-filter">
                  <Filter size={15} /><span>وضعیت</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">همه</option>
                    <option value="active">فعال</option>
                    <option value="pending">در انتظار</option>
                    <option value="revoked">لغوشده</option>
                  </select>
                </label>
                <label className="admin-mobile-filter">
                  <Wifi size={15} /><span>اتصال</span>
                  <select value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value)}>
                    <option value="all">همه</option>
                    <option value="online">آنلاین</option>
                    <option value="stale">نیازمند توجه</option>
                    <option value="offline">آفلاین</option>
                    <option value="attention">هشدار</option>
                  </select>
                </label>
                <label className="admin-mobile-filter">
                  <ShieldCheck size={15} /><span>مدیریت</span>
                  <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
                    <option value="all">همه</option>
                    <option value="device_owner">Device Owner</option>
                    <option value="profile_owner">Work Profile</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="admin-mobile-filter">
                  <Clock3 size={15} /><span>مرتب‌سازی</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="attention">نیازمند توجه</option>
                    <option value="lastSeen">آخرین مشاهده</option>
                    <option value="created">تاریخ ثبت</option>
                    <option value="name">نام کارمند</option>
                    <option value="status">وضعیت</option>
                  </select>
                </label>
              </div>

              {visibleDevices.length ? (
                <div className="admin-mobile-fleet-list">
                  {visibleDevices.map((device) => (
                    <DeviceCard key={device.id} device={device} onStatusChange={changeStatus} busyDeviceId={busyDeviceId} />
                  ))}
                </div>
              ) : (
                <div className="admin-mobile-empty-state">
                  <Search size={22} />
                  <strong>دستگاهی با این فیلترها پیدا نشد.</strong>
                  <span>فیلترها یا عبارت جست‌وجو را تغییر دهید.</span>
                </div>
              )}
            </section>

            <section className="admin-mobile-two-column">
              <PolicyCenter policy={summary.policy} />

              <section className="admin-mobile-panel">
                <div className="admin-mobile-section-head">
                  <div>
                    <span className="admin-mobile-section-kicker">Employees</span>
                    <h2>کارکنان دارای فضای مدیریتی</h2>
                  </div>
                  <span className="admin-mobile-count">{staffLoading ? "در حال دریافت…" : staff.length.toLocaleString("fa-IR") + " نفر"}</span>
                </div>
                <div className="admin-mobile-employee-grid admin-mobile-employee-grid-compact">
                  {staff.map((person) => (
                    <EmployeeCard
                      key={person.id}
                      person={person}
                      deviceCount={summary.devices.filter((device) => device.staffId === person.id).length}
                    />
                  ))}
                </div>
              </section>
            </section>

            <AuditMiniPanel />
          </>
        ) : null}

        <div className="admin-mobile-footer-links">
          <Link to="/admin" className="admin-mobile-secondary-action"><ArrowRight size={16} /> بازگشت به پنل مدیریت</Link>
          <span>{SITE.nameFa} · Fleet Center</span>
        </div>
      </div>

      {confirmDevice ? (
        <ConfirmAction
          device={confirmDevice}
          busy={busyDeviceId === confirmDevice.deviceId}
          onClose={() => setConfirmDevice(null)}
          onConfirm={() => void confirmRevoke()}
        />
      ) : null}
      <EnrollmentWizard open={enrollmentOpen} onClose={() => setEnrollmentOpen(false)} />
    </main>
  );
}

function statusPriority(status: string) {
  if (status === "pending") return 0;
  if (status === "active") return 1;
  if (status === "revoked") return 2;
  return 3;
}

export function AdminMobileEmployeePage({ employeeId }: { employeeId: string }) {
  const auth = useAdminAccess();
  const { summary, staff, loading, error, load } = useFleetData(auth === "authenticated");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [tab, setTab] = useState<"overview" | "device" | "permissions" | "location" | "activity" | "security" | "reports">("overview");
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");

  const person = useMemo(
    () => staff.find((item) => item.id.trim().toLowerCase() === employeeId.trim().toLowerCase()) ?? null,
    [staff, employeeId],
  );
  const personDevices = useMemo(
    () => (summary?.devices ?? []).filter((device) => device.staffId.trim().toLowerCase() === employeeId.trim().toLowerCase()),
    [summary, employeeId],
  );

  useEffect(() => {
    if (!selectedDeviceId && personDevices[0]) setSelectedDeviceId(personDevices[0].deviceId);
    if (selectedDeviceId && !personDevices.some((device) => device.deviceId === selectedDeviceId)) setSelectedDeviceId(personDevices[0]?.deviceId ?? "");
  }, [personDevices, selectedDeviceId]);

  const selectedDevice = personDevices.find((device) => device.deviceId === selectedDeviceId) ?? personDevices[0] ?? null;

  const loadTelemetry = useCallback(async () => {
    if (!selectedDevice) return;
    setTelemetryLoading(true);
    setTelemetryError("");
    try {
      setTelemetry(await fetchTelemetry(selectedDevice.deviceId));
    } catch (cause) {
      setTelemetryError(cause instanceof Error ? cause.message : "داده فعالیت دریافت نشد.");
    } finally {
      setTelemetryLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedDevice || (tab !== "activity" && tab !== "location")) return;
    void loadTelemetry();
  }, [selectedDevice, tab, loadTelemetry]);

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  if (loading && !person) {
    return <main className="admin-mobile-page"><div className="admin-mobile-shell admin-mobile-centered"><section className="admin-mobile-panel admin-mobile-empty-card"><h1>در حال دریافت اطلاعات</h1><p>پروفایل کارمند و وضعیت دستگاه‌ها در حال بارگذاری است…</p></section></div></main>;
  }

  if (!person) {
    return <main className="admin-mobile-page"><div className="admin-mobile-shell admin-mobile-centered"><section className="admin-mobile-panel admin-mobile-empty-card"><span className="admin-mobile-kicker">کارمند</span><h1>کارمند پیدا نشد</h1><p>{error || "کارمند انتخاب‌شده در فهرست فعال هیرمند وجود ندارد."}</p><Link to="/admin-mobile-management" search={{}} className="admin-mobile-primary-action"><ArrowRight size={17} /> بازگشت</Link></section></div></main>;
  }

  const onlineCount = personDevices.filter((device) => device.presence === "online").length;
  const attentionCount = personDevices.filter((device) => device.needsAttention).length;
  const permissionDeniedCount = personDevices.reduce((count, device) => count + device.permissions.filter((item) => item.status === "denied").length, 0);
  const latestLocation = telemetry?.locations[0] ?? null;

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <div className="admin-mobile-breadcrumbs">
          <Link to="/admin-mobile-management" search={{}}>مدیریت تلفن همراه</Link>
          <ChevronLeft size={14} aria-hidden="true" />
          <span>{person.name}</span>
        </div>

        <PageHeader
          eyebrow={person.role}
          title={person.name}
          description="پروفایل مدیریتی کارمند؛ وضعیت دستگاه، permissions، activity و قابلیت‌های واقعی Android Enterprise را مشاهده کنید."
          action={<Link to="/admin-mobile-management" search={{}} className="admin-mobile-secondary-action"><ArrowRight size={16} /> بازگشت به ناوگان</Link>}
        />

        <section className="admin-mobile-person-banner">
          <div className="admin-mobile-person-main">
            <div className="admin-mobile-avatar admin-mobile-avatar-large"><UserRound size={30} /></div>
            <div>
              <span className="admin-mobile-section-kicker">Employee Mobile Profile</span>
              <h2>{person.name}</h2>
              <p>{person.role} · <bdi dir="ltr">{person.id}</bdi></p>
            </div>
          </div>
          <div className="admin-mobile-person-metrics">
            <div><strong>{personDevices.length.toLocaleString("fa-IR")}</strong><span>دستگاه</span></div>
            <div><strong>{onlineCount.toLocaleString("fa-IR")}</strong><span>آنلاین</span></div>
            <div><strong>{attentionCount.toLocaleString("fa-IR")}</strong><span>نیازمند توجه</span></div>
            <div><strong>{permissionDeniedCount.toLocaleString("fa-IR")}</strong><span>مجوز غیرفعال</span></div>
          </div>
        </section>

        {error ? <div className="admin-mobile-error"><AlertTriangle size={17} /> <span>{error}</span><button type="button" className="admin-mobile-icon-button" onClick={() => void load()}>تلاش دوباره</button></div> : null}

        {personDevices.length ? (
          <>
            <section className="admin-mobile-panel">
              <div className="admin-mobile-section-head">
                <div>
                  <span className="admin-mobile-section-kicker">Device Focus</span>
                  <h2>دستگاه فعال پروفایل</h2>
                </div>
                {personDevices.length > 1 ? (
                  <select className="admin-mobile-device-select" value={selectedDevice?.deviceId ?? ""} onChange={(event) => setSelectedDeviceId(event.target.value)}>
                    {personDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.model || device.deviceId} · {deviceStatusLabel(device.status)}</option>)}
                  </select>
                ) : null}
              </div>

              {selectedDevice ? (
                <div className="admin-mobile-device-hero">
                  <div className="admin-mobile-device-icon admin-mobile-device-icon-large"><Smartphone size={30} /></div>
                  <div>
                    <div className="admin-mobile-fleet-subline">
                      <span className={"admin-mobile-badge admin-mobile-badge-" + statusTone(selectedDevice.status)}>{deviceStatusLabel(selectedDevice.status)}</span>
                      <ManagementBadge mode={selectedDevice.managementMode} />
                      <PresenceBadge device={selectedDevice} />
                    </div>
                    <h3>{[selectedDevice.manufacturer, selectedDevice.model].filter(Boolean).join(" ") || "مدل نامشخص"}</h3>
                    <p><bdi dir="ltr">{selectedDevice.deviceId}</bdi> · آخرین مشاهده {formatDateTime(selectedDevice.lastSeenAt)}</p>
                  </div>
                </div>
              ) : null}
            </section>

            <nav className="admin-mobile-tabs" aria-label="بخش‌های پروفایل دستگاه">
              {([
                ["overview", "نمای کلی", <Smartphone size={15} />],
                ["device", "دستگاه", <Cpu size={15} />],
                ["permissions", "مجوزها", <KeyRound size={15} />],
                ["location", "موقعیت", <MapPin size={15} />],
                ["activity", "فعالیت", <ClipboardList size={15} />],
                ["security", "امنیت", <ShieldCheck size={15} />],
                ["reports", "گزارش", <DatabaseZap size={15} />],
              ] as const).map(([value, label, icon]) => (
                <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{icon}<span>{label}</span></button>
              ))}
            </nav>

            {tab === "overview" ? (
              <OverviewTab device={selectedDevice} telemetry={telemetry} />
            ) : tab === "device" ? (
              <DeviceTab device={selectedDevice} />
            ) : tab === "permissions" ? (
              <PermissionsTab device={selectedDevice} />
            ) : tab === "location" ? (
              <LocationTab device={selectedDevice} telemetry={telemetry} loading={telemetryLoading} error={telemetryError} latestLocation={latestLocation} onRefresh={() => void loadTelemetry()} />
            ) : tab === "activity" ? (
              <ActivityTab telemetry={telemetry} loading={telemetryLoading} error={telemetryError} onRefresh={() => void loadTelemetry()} />
            ) : tab === "security" ? (
              <SecurityTab device={selectedDevice} />
            ) : (
              <ReportsTab devices={personDevices} />
            )}

            <section className="admin-mobile-panel">
              <div className="admin-mobile-section-head">
                <div><span className="admin-mobile-section-kicker">All Devices</span><h2>دستگاه‌های این کارمند</h2></div>
              </div>
              <div className="admin-mobile-fleet-list">
                {personDevices.map((device) => <DeviceCard key={device.id} device={device} onStatusChange={() => undefined} busyDeviceId="" compact />)}
              </div>
            </section>
          </>
        ) : (
          <section className="admin-mobile-panel">
            <div className="admin-mobile-empty-state admin-mobile-empty-state-large">
              <Smartphone size={28} />
              <strong>هنوز دستگاهی برای این کارمند ثبت نشده است.</strong>
              <span>از مرکز Fleet یک enrollment جدید شروع کنید؛ ثبت دستگاه پس از اجرای اپ انجام می‌شود.</span>
              <Link to="/admin-mobile-management" search={{}} className="admin-mobile-primary-action">بازگشت به مرکز ناوگان</Link>
            </div>
          </section>
        )}

        <div className="admin-mobile-footer-links">
          <Link to="/admin-mobile-management" search={{}} className="admin-mobile-secondary-action"><ArrowRight size={16} /> بازگشت به ناوگان</Link>
          <Link to="/admin" className="admin-mobile-secondary-action">پنل مدیریت</Link>
        </div>
      </div>
    </main>
  );
}

function OverviewTab({ device, telemetry }: { device: MobileDevice; telemetry: TelemetryResponse | null }) {
  const heartbeatPayload = telemetry?.telemetry.find((item) => item.eventType === "app_heartbeat")?.payload;
  return (
    <section className="admin-mobile-two-column">
      <section className="admin-mobile-panel">
        <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Overview</span><h2>وضعیت کلی</h2></div></div>
        <div className="admin-mobile-summary-grid">
          <SummaryStat label="وضعیت اتصال" value={device.presenceLabel} detail={formatRelativeAge(device.lastSeenAt)} icon={<Wifi size={17} />} />
          <SummaryStat label="حالت مدیریت" value={device.managementModeLabel} detail={managementModeShortLabel(device.managementMode)} icon={<ShieldCheck size={17} />} />
          <SummaryStat label="نسخه اپ" value={device.appVersionName || "—"} detail={"build " + device.appVersionCode.toLocaleString("fa-IR")} icon={<Smartphone size={17} />} />
          <SummaryStat label="آخرین sync" value={formatRelativeAge(device.lastSyncAt)} detail={formatDateTime(device.lastSyncAt)} icon={<RefreshCw size={17} />} />
        </div>
      </section>
      <section className="admin-mobile-panel">
        <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Health</span><h2>سلامت مدیریتی</h2></div></div>
        <HealthBar label="امنیت" state={device.policy.management === "operational" ? "healthy" : "warning"} text={device.policy.management === "operational" ? "حالت مدیریت مشخص است" : "نیازمند تعیین حالت مدیریت"} />
        <HealthBar label="مجوزها" state={device.policy.permissions === "operational" ? "healthy" : "warning"} text={device.policy.permissions === "operational" ? "permission_state دریافت شده" : "در انتظار telemetry مجوزها"} />
        <HealthBar label="sync" state={device.policy.sync === "operational" ? "healthy" : "warning"} text={device.lastSeenAt ? "heartbeat واقعی ثبت شده" : "heartbeat ثبت نشده"} />
        <HealthBar label="location" state={device.policy.location === "available" ? "healthy" : "neutral"} text={device.policy.location === "available" ? "داده location موجود است" : "collector فعال نیست"} />
        {heartbeatPayload && typeof heartbeatPayload === "object" ? (
          <div className="admin-mobile-mini-note"><Info size={14} /> metadata heartbeat موجود است و فقط داده‌های فنی موردنیاز پنل استفاده می‌شود.</div>
        ) : null}
      </section>
    </section>
  );
}

function DeviceTab({ device }: { device: MobileDevice }) {
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Device Metadata</span><h2>مشخصات فنی دستگاه</h2></div></div>
      <div className="admin-mobile-detail-grid">
        <DetailRow label="Device ID" value={device.deviceId} ltr />
        <DetailRow label="Manufacturer" value={device.manufacturer || "—"} />
        <DetailRow label="Model" value={device.model || "—"} />
        <DetailRow label="Android" value={device.androidVersion || "—"} />
        <DetailRow label="SDK" value={device.sdkInt == null ? "—" : device.sdkInt.toLocaleString("fa-IR")} />
        <DetailRow label="App version" value={device.appVersionName || "—"} />
        <DetailRow label="App build" value={device.appVersionCode.toLocaleString("fa-IR")} />
        <DetailRow label="Enrollment" value={formatDateTime(device.createdAt)} />
        <DetailRow label="Approved" value={formatDateTime(device.approvedAt)} />
        <DetailRow label="Last sync" value={formatDateTime(device.lastSyncAt)} />
      </div>
    </section>
  );
}

function PermissionsTab({ device }: { device: MobileDevice }) {
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Permission Health</span><h2>وضعیت مجوزهای واقعی اپ</h2></div><span className="admin-mobile-count">{formatDateTime(device.latestPermissionAt)}</span></div>
      {device.permissions.length ? (
        <div className="admin-mobile-permission-grid">
          {device.permissions.map((item) => (
            <article className="admin-mobile-permission-card" key={item.key}>
              <div className={"admin-mobile-permission-icon is-" + item.status}>
                {item.status === "granted" ? <CheckCircle2 size={17} /> : item.status === "denied" ? <Ban size={17} /> : <Info size={17} />}
              </div>
              <div><strong>{item.label}</strong><span>{permissionLabel(item.status)}</span></div>
              <em>{item.status === "granted" ? "OK" : item.status === "denied" ? "Check" : "Unknown"}</em>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-mobile-empty-state"><KeyRound size={21} /><strong>هنوز permission_state برای این دستگاه دریافت نشده است.</strong><span>در وضعیت فعلی، از روی manifest فرض نمی‌کنیم که مجوزی فعال است.</span></div>
      )}
    </section>
  );
}

function LocationTab({
  device,
  telemetry,
  loading,
  error,
  latestLocation,
  onRefresh,
}: {
  device: MobileDevice;
  telemetry: TelemetryResponse | null;
  loading: boolean;
  error: string;
  latestLocation: TelemetryResponse["locations"][number] | null;
  onRefresh: () => void;
}) {
  const available = device.locationCapability === "available" && latestLocation;
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Location</span><h2>مدیریت موقعیت</h2></div><button type="button" className="admin-mobile-icon-button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? "admin-mobile-spin" : undefined} /> بروزرسانی</button></div>
      {error ? <div className="admin-mobile-error">{error}</div> : null}
      {available ? (
        <div className="admin-mobile-location-card">
          <div className="admin-mobile-location-icon"><MapPin size={22} /></div>
          <div>
            <span>آخرین location ذخیره‌شده</span>
            <strong><bdi dir="ltr">{latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}</bdi></strong>
            <small>{latestLocation.provider || "provider نامشخص"} · {formatDateTime(latestLocation.observedAt)} · {latestLocation.accuracyM == null ? "دقت نامشخص" : "دقت " + latestLocation.accuracyM.toLocaleString("fa-IR") + " متر"}</small>
          </div>
          <span className="admin-mobile-location-status">داده موجود</span>
        </div>
      ) : (
        <div className="admin-mobile-location-disabled">
          <div className="admin-mobile-location-icon"><MapPin size={22} /></div>
          <div>
            <strong>جمع‌آوری موقعیت در این نسخه فعال نیست.</strong>
            <span>پنل داده جعلی یا «live tracking» ساختگی نمایش نمی‌دهد. اگر collector واقعی و شفاف در آینده فعال شود، داده آن از همین بخش قابل اتصال است.</span>
          </div>
        </div>
      )}
      {telemetry && !latestLocation ? <div className="admin-mobile-mini-note"><Info size={14} /> telemetry دریافت شد ولی رکورد location وجود ندارد.</div> : null}
    </section>
  );
}

function ActivityTab({
  telemetry,
  loading,
  error,
  onRefresh,
}: {
  telemetry: TelemetryResponse | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Activity</span><h2>رویدادهای telemetry</h2></div><button type="button" className="admin-mobile-icon-button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? "admin-mobile-spin" : undefined} /> بروزرسانی</button></div>
      {error ? <div className="admin-mobile-error">{error}</div> : null}
      {loading && !telemetry ? <div className="admin-mobile-empty-state">در حال دریافت رویدادها…</div> : telemetry?.telemetry.length ? (
        <div className="admin-mobile-activity-list">
          {telemetry.telemetry.map((item) => (
            <article className="admin-mobile-activity-row" key={item.id}>
              <div className="admin-mobile-activity-icon"><ClipboardList size={15} /></div>
              <div>
                <strong>{item.eventType === "app_heartbeat" ? "Heartbeat اپ" : item.eventType === "permission_state" ? "وضعیت مجوزها" : item.eventType}</strong>
                <span>{formatDateTime(item.observedAt)} · دریافت در {formatDateTime(item.receivedAt)}</span>
              </div>
              <code>{JSON.stringify(item.payload).slice(0, 160)}</code>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-mobile-empty-state"><ClipboardList size={21} /><span>هنوز telemetry برای این دستگاه ثبت نشده است.</span></div>
      )}
    </section>
  );
}

function SecurityTab({ device }: { device: MobileDevice }) {
  const mode = parseManagementMode(device.managementMode);
  return (
    <section className="admin-mobile-two-column">
      <section className="admin-mobile-panel">
        <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Security</span><h2>وضعیت امنیتی</h2></div></div>
        <div className="admin-mobile-security-hero">
          <div className="admin-mobile-security-icon"><ShieldCheck size={22} /></div>
          <div>
            <strong>{device.managementModeLabel}</strong>
            <span>{mode === "device_owner" ? "گوشی در حالت مدیریت کامل سازمانی شناسایی شده است." : mode === "profile_owner" ? "گوشی شخصی با فضای کاری جداگانه شناسایی شده است." : "حالت مدیریت هنوز از Android گزارش نشده است."}</span>
          </div>
        </div>
        <div className="admin-mobile-detail-grid">
          <DetailRow label="Management mode" value={managementModeShortLabel(mode)} />
          <DetailRow label="Registration status" value={deviceStatusLabel(device.status)} />
          <DetailRow label="Security permission" value="security.manage برای پنل اجباری است" />
          <DetailRow label="Audit" value="عملیات approve/revoke ثبت می‌شوند" />
        </div>
      </section>
      <section className="admin-mobile-panel">
        <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Boundary</span><h2>مرز دسترسی</h2></div></div>
        <div className="admin-mobile-policy-note">
          <ShieldAlert size={17} />
          <span>این پنل اطلاعات فنی موردنیاز مدیریت دستگاه را نمایش می‌دهد و تا وقتی collector واقعی و شفاف فعال نشده، SMS، تماس، فایل شخصی، notification content یا screen capture مخفی را به‌عنوان capability فعال اعلام نمی‌کند.</span>
        </div>
      </section>
    </section>
  );
}

function ReportsTab({ devices }: { devices: MobileDevice[] }) {
  const statuses: Array<[string, number]> = [
    ["فعال", devices.filter((device) => device.status === "active").length],
    ["در انتظار", devices.filter((device) => device.status === "pending").length],
    ["لغوشده", devices.filter((device) => device.status === "revoked").length],
    ["آنلاین", devices.filter((device) => device.presence === "online").length],
    ["نیازمند توجه", devices.filter((device) => device.needsAttention).length],
  ];
  return (
    <section className="admin-mobile-panel">
      <div className="admin-mobile-section-head"><div><span className="admin-mobile-section-kicker">Reports</span><h2>گزارش خلاصه کارمند</h2></div><span className="admin-mobile-count">مبنای داده: دستگاه‌های ثبت‌شده</span></div>
      <div className="admin-mobile-report-grid">
        {statuses.map(([label, value]) => <SummaryStat key={label} label={label} value={Number(value).toLocaleString("fa-IR")} detail="وضعیت فعلی" icon={<DatabaseZap size={17} />} />)}
      </div>
      <div className="admin-mobile-mini-note"><Info size={14} /> trend یا نمودار تاریخی در این نسخه اضافه نشده چون داده تاریخی کافی برای نمایش روند واقعی فراهم نیست.</div>
    </section>
  );
}

function SummaryStat({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="admin-mobile-summary-stat"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function HealthBar({ label, state, text }: { label: string; state: "healthy" | "warning" | "neutral"; text: string }) {
  return <div className="admin-mobile-health-row"><span>{label}</span><div className={"admin-mobile-health-pill is-" + state}><i />{text}</div></div>;
}

function DetailRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div className="admin-mobile-detail-row"><span>{label}</span><strong className={ltr ? "admin-mobile-ltr" : ""}>{value}</strong></div>;
}
