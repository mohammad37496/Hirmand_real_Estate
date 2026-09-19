import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, KeyRound, LayoutDashboard, LogOut, RefreshCw } from "lucide-react";
import { listAdminProperties, type Property } from "@/lib/properties";
import { toast, Toaster } from "sonner";
import { AdminDashboardCharts } from "@/components/hirmand/admin-dashboard-charts";
import { ADMIN_CSS } from "@/components/hirmand/admin-shell-css";

const STORAGE_KEY = "hirmand_admin_key";

export function AdminPropertiesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [view, setView] = useState<"dashboard" | "list">("dashboard");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) {
        setKeyInput(saved);
        void unlock(saved, false);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(key = keyInput.trim(), showToast = true) {
    if (!key) {
      toast.error("کلید مدیریت را وارد کنید.");
      return;
    }
    setLoadingList(true);
    try {
      const rows = await listAdminProperties({ data: { adminKey: key, limit: 100 } });
      setAdminKey(key);
      setProperties(rows);
      setUnlocked(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, key);
      } catch {
        /* ignore */
      }
      if (showToast) toast.success("ورود موفق بود.");
    } catch (error) {
      setUnlocked(false);
      toast.error(error instanceof Error ? error.message : "کلید نادرست است.");
    } finally {
      setLoadingList(false);
    }
  }

  function logout() {
    setUnlocked(false);
    setAdminKey("");
    setKeyInput("");
    setProperties([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  if (!unlocked) {
    return (
      <div className="admin-login">
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
        <div className="admin-login-card">
          <span className="kicker">پنل داخلی هیرمند</span>
          <h1>ورود به مدیریت</h1>
          <p>کلید HIRMAND_ADMIN_KEY را وارد کنید.</p>
          <div className="admin-key-row">
            <input
              type="password"
              dir="ltr"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
              placeholder="HIRMAND_ADMIN_KEY"
            />
            <button
              type="button"
              className="btn-gold"
              disabled={loadingList || !keyInput.trim()}
              onClick={() => void unlock()}
            >
              {loadingList ? <RefreshCw size={16} className="admin-spin" /> : <KeyRound size={16} />}
              ورود
            </button>
          </div>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link to="/" className="btn-ghost">
              بازگشت به سایت
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <Toaster position="top-center" dir="rtl" richColors closeButton />
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <BarChart3 size={22} color="#c9a24a" />
          <div>
            <strong>هیرمند</strong>
            <small>پنل مدیریت</small>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={`admin-nav-btn${view === "dashboard" ? " is-active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            <BarChart3 size={18} />
            داشبورد و نمودارها
          </button>
          <button
            type="button"
            className={`admin-nav-btn${view === "list" ? " is-active" : ""}`}
            onClick={() => setView("list")}
          >
            <LayoutDashboard size={18} />
            فهرست فایل‌ها
          </button>
        </nav>
        <div className="admin-sidebar-foot">
          <button
            type="button"
            className="admin-nav-btn"
            onClick={() => void unlock(adminKey, false)}
            disabled={loadingList}
          >
            <RefreshCw size={18} className={loadingList ? "admin-spin" : undefined} />
            به‌روزرسانی
          </button>
          <Link to="/" className="admin-nav-btn">
            سایت
          </Link>
          <button type="button" className="admin-nav-btn" onClick={logout}>
            <LogOut size={18} />
            خروج
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{view === "dashboard" ? "داشبورد فروش و آمار" : "فهرست فایل‌ها"}</h1>
            <p>{properties.length.toLocaleString("fa-IR")} فایل</p>
          </div>
        </header>
        <div className="admin-content">
          {view === "dashboard" ? <AdminDashboardCharts properties={properties} /> : null}
          {view === "list" ? (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="kicker">فایل‌ها</span>
                  <h2>{properties.length.toLocaleString("fa-IR")} مورد</h2>
                </div>
              </div>
              {properties.length === 0 ? (
                <div className="admin-empty">
                  <strong>فایلی نیست</strong>
                </div>
              ) : (
                <div className="admin-property-list">
                  {properties.map((p) => (
                    <article key={p.id} className="admin-property-card">
                      <div className="admin-property-thumb">
                        <img
                          src={p.images[0] || "/images/type-apartment.jpg"}
                          alt=""
                          loading="lazy"
                        />
                      </div>
                      <div className="admin-property-meta">
                        <div className="admin-property-tags">
                          <span data-status={p.status}>
                            {p.status === "published"
                              ? "منتشرشده"
                              : p.status === "draft"
                                ? "پیش‌نویس"
                                : "بایگانی"}
                          </span>
                          {p.featured ? <span data-featured>ویژه</span> : null}
                        </div>
                        <h3>{p.title}</h3>
                        <p>
                          {p.neighborhood} · {p.contactName}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
      <nav className="admin-mobile-nav">
        <button
          type="button"
          className={view === "dashboard" ? "is-active" : ""}
          onClick={() => setView("dashboard")}
        >
          <BarChart3 size={20} />
          آمار
        </button>
        <button
          type="button"
          className={view === "list" ? "is-active" : ""}
          onClick={() => setView("list")}
        >
          <LayoutDashboard size={20} />
          فهرست
        </button>
        <Link to="/">سایت</Link>
      </nav>
    </div>
  );
}
