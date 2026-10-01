import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { SITE } from "@/lib/site";
import "@/login.css";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `ورود به حساب | ${SITE.nameFa}` },
      { name: "description", content: "ورود به حساب مشتری هیرمند برای همگام‌سازی فایل‌ها و درخواست‌ها." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(providerId: string) {
    setBusy(true);
    setError("");
    try {
      await signIn(providerId, { callbackURL: "/customer-dashboard", errorCallbackURL: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود انجام نشد.");
      setBusy(false);
    }
  }

  if (user && !isPending) {
    return (
      <SiteChrome>
        <main className="login-page">
          <section className="login-card login-card-success">
            <div className="login-icon"><UserRound size={28} /></div>
            <span className="kicker">حساب فعال</span>
            <h1>شما وارد حساب هستید</h1>
            <p>{user.displayName || user.primaryEmail || "حساب هیرمند"} آماده استفاده است.</p>
            <div className="login-actions">
              <Link to="/customer-dashboard" className="btn-gold">رفتن به داشبورد</Link>
              <Link to="/" className="btn-ghost"><ArrowLeft size={14} /> بازگشت</Link>
            </div>
          </section>
        </main>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome>
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand"><span className="login-logo"><Sparkles size={22} /></span><div><span className="kicker">حساب مشتری</span><strong>HIRMAND REAL ESTATE</strong></div></div>
          <h1>ورود برای همگام‌سازی اطلاعات</h1>
          <p className="login-lead">با ورود به حساب، فایل‌های ذخیره‌شده، جست‌وجوها، درخواست‌ها و بازدیدهای شما بین دستگاه‌ها قابل بازیابی می‌شوند.</p>

          {!authEnabled ? (
            <div className="login-disabled"><ShieldCheck size={20} /><span>سیستم حساب کاربری در این محیط هنوز توسط پیکربندی انتشار فعال نشده است.</span></div>
          ) : (
            <>
              <div className="login-provider-list">
                {GROK_PROVIDERS.map((provider) => (
                  <button key={provider.providerId} type="button" className="login-provider" disabled={busy} onClick={() => void handleSignIn(provider.providerId)}>
                    <span className="login-provider-mark">{provider.providerId.includes("google") ? "G" : "X"}</span>
                    <span>ورود با {provider.label}</span>
                  </button>
                ))}
              </div>
              <small className="login-security"><ShieldCheck size={14} /> احراز هویت روی همان سامانه Better Auth پروژه انجام می‌شود.</small>
            </>
          )}

          {error ? <div className="login-error" role="alert">{error}</div> : null}

          <div className="login-footer">
            <Link to="/customer-dashboard">مشاهده داشبورد</Link>
            <Link to="/"><ArrowLeft size={13} /> بازگشت به سایت</Link>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
