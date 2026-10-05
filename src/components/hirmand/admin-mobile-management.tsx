import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, LockKeyhole, Smartphone, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SITE, TEAM, type TeamMember } from "@/lib/site";
import "@/admin-mobile-management.css";

type AuthState = "checking" | "authenticated" | "unauthenticated";

async function readAdminSession(): Promise<AuthState> {
  try {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "login" }),
    });
    const data = (await response.json().catch(() => null)) as
      | { authenticated?: boolean }
      | null;
    return response.ok && data?.authenticated ? "authenticated" : "unauthenticated";
  } catch {
    return "unauthenticated";
  }
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

function EmployeeCard({ person }: { person: TeamMember }) {
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
        <span>{person.phoneDisplay}</span>
      </div>
      <div className="admin-mobile-card-arrow" aria-hidden="true">
        <ChevronLeft size={20} />
      </div>
    </Link>
  );
}

export function AdminMobileManagementPage() {
  const auth = useAdminAccess();

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  return (
    <main className="admin-mobile-page">
      <div className="admin-mobile-shell">
        <PageHeader
          eyebrow="مدیریت داخلی"
          title="مدیریت تلفن همراه"
          description="ابتدا کارمند موردنظر را انتخاب کنید؛ تنظیمات اختصاصی هر کارمند در صفحه بعد قرار می‌گیرد."
        />

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">کارکنان</span>
              <h2>انتخاب کارمند بنگاه</h2>
            </div>
            <span className="admin-mobile-count">{TEAM.length.toLocaleString("fa-IR")} نفر</span>
          </div>

          <div className="admin-mobile-selection-note">
            <CheckCircle2 size={18} />
            <span>
              فهرست فعلاً از اعضای تیم هیرمند استفاده می‌کند و هنوز به زیرساخت تلفن همراه متصل نیست.
            </span>
          </div>

          <div className="admin-mobile-employee-grid">
            {TEAM.map((person) => (
              <EmployeeCard key={person.id} person={person} />
            ))}
          </div>
        </section>

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
  const person = TEAM.find((item) => item.id === employeeId);

  if (auth === "checking") return <AccessGate checking />;
  if (auth === "unauthenticated") return <AccessGate />;

  if (!person) {
    return (
      <main className="admin-mobile-page">
        <div className="admin-mobile-shell admin-mobile-centered">
          <section className="admin-mobile-panel admin-mobile-empty-card">
            <span className="admin-mobile-kicker">کارمند</span>
            <h1>کارمند پیدا نشد</h1>
            <p>کارمند انتخاب‌شده در فهرست فعلی هیرمند وجود ندارد.</p>
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
          description="این صفحه برای مدیریت تنظیمات تلفن همراه این کارمند آماده شده است. زیرساخت اتصال در این مرحله عمداً متصل نشده است."
        />

        <section className="admin-mobile-panel">
          <div className="admin-mobile-person-hero">
            <div className="admin-mobile-avatar admin-mobile-avatar-large" aria-hidden="true">
              <UserRound size={34} />
            </div>
            <div>
              <span className="admin-mobile-section-kicker">کارمند انتخاب‌شده</span>
              <h2>{person.name}</h2>
              <p>{person.role} · <bdi dir="ltr">{person.phoneDisplay}</bdi></p>
            </div>
          </div>

          <div className="admin-mobile-placeholder-grid">
            <div className="admin-mobile-placeholder-card">
              <Smartphone size={20} />
              <strong>اتصال تلفن</strong>
              <span>زیرساخت هنوز متصل نشده است.</span>
            </div>
            <div className="admin-mobile-placeholder-card">
              <UserRound size={20} />
              <strong>کاربر مسئول</strong>
              <span>{person.name}</span>
            </div>
          </div>
        </section>

        <section className="admin-mobile-panel">
          <div className="admin-mobile-section-head">
            <div>
              <span className="admin-mobile-section-kicker">تغییر انتخاب</span>
              <h2>کارمند دیگری را انتخاب کنید</h2>
            </div>
          </div>
          <div className="admin-mobile-employee-grid admin-mobile-employee-grid-compact">
            {TEAM.map((item) => (
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
