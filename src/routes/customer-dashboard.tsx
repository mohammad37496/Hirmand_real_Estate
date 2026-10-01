import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ExternalLink,
  FileHeart,
  FileText,
  Heart,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";
import "@/customer-dashboard.css";

type DashboardResponse = {
  enabled?: boolean;
  stats?: { favorites: number; searches: number; requests: number; visits: number; alerts: number; watches: number };
  favorites?: Array<{ slug: string; title: string; neighborhood: string; image: string | null; areaM2: number | null; bedrooms: number | null; availabilityStatus: string }>;
  searches?: Array<{ clientId: string; name: string; params: string; updatedAt: string }>;
  requests?: Array<{
    id: string;
    trackingToken: string | null;
    deal: string;
    propertyType: string;
    neighborhood: string;
    status: string;
    visitStatus: string;
    preferredAt: string | null;
    createdAt: string;
    updatedAt: string;
    propertyTitle: string;
    propertySlug: string;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  follow_up: "در انتظار پیگیری",
  visited: "بازدید انجام شد",
  contract: "قرارداد",
  closed: "بسته‌شده",
  spam: "نامعتبر",
};

const VISIT_LABEL: Record<string, string> = {
  none: "بدون بازدید",
  requested: "درخواست بازدید",
  confirmed: "بازدید تأیید شد",
  completed: "بازدید انجام شد",
  cancelled: "بازدید لغو شد",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function searchHref(params: string) {
  return "/properties?" + params;
}

export const Route = createFileRoute("/customer-dashboard")({
  head: () => ({
    meta: [
      { title: `داشبورد من | ${SITE.nameFa}` },
      { name: "description", content: "مدیریت فایل‌های ذخیره‌شده، جست‌وجوها، درخواست‌ها و بازدیدهای شما در هیرمند." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomerDashboardPage,
});

function CustomerDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [favoriteProperties, setFavoriteProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-dashboard", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const next = await response.json().catch(() => null) as DashboardResponse | null;
      if (!response.ok) throw new Error("داشبورد در دسترس نیست.");
      setData(next);

      const slugs = (next?.favorites ?? []).map((item) => item.slug);
      if (slugs.length) {
        setFavoriteLoading(true);
        try {
          setFavoriteProperties(await listPublishedPropertiesBySlugs({ data: { slugs } }));
        } finally {
          setFavoriteLoading(false);
        }
      } else {
        setFavoriteProperties([]);
      }
    } catch {
      setData({ enabled: false });
      setFavoriteProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats ?? { favorites: 0, searches: 0, requests: 0, visits: 0, alerts: 0, watches: 0 };
  const requests = data?.requests ?? [];
  const searches = data?.searches ?? [];

  const nextVisit = useMemo(
    () => requests
      .filter((item) => item.preferredAt && ["requested", "confirmed"].includes(item.visitStatus))
      .sort((a, b) => new Date(a.preferredAt!).getTime() - new Date(b.preferredAt!).getTime())[0] ?? null,
    [requests],
  );

  return (
    <SiteChrome className="customer-dashboard-shell">
      <main className="customer-dashboard-page">
        <header className="customer-dashboard-hero">
          <div className="customer-dashboard-hero-copy">
            <span className="kicker"><UserRound size={14} /> پنل مشتری</span>
            <h1>داشبورد من</h1>
            <p>فایل‌های منتخب، جست‌وجوهای فعال و درخواست‌های این مرورگر را از یکجا مدیریت و پیگیری کنید.</p>
          </div>
          <div className="customer-dashboard-hero-actions">
            <Link to="/properties" className="btn-ghost"><Search size={15} /> جست‌وجوی فایل</Link>
            <button type="button" className="btn-gold" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} className={loading ? "admin-spin" : ""} /> تازه‌سازی
            </button>
          </div>
        </header>

        {loading ? (
          <section className="customer-dashboard-card customer-dashboard-empty">
            <RefreshCw size={26} className="admin-spin" />
            <strong>در حال بارگذاری داشبورد…</strong>
          </section>
        ) : !data?.enabled ? (
          <section className="customer-dashboard-card customer-dashboard-empty">
            <FileText size={28} />
            <strong>داشبورد آنلاین فعلاً فعال نیست.</strong>
            <Link to="/properties" className="btn-gold">مشاهده فایل‌ها</Link>
          </section>
        ) : (
          <>
            <section className="customer-dashboard-stats" aria-label="خلاصه فعالیت مشتری">
              <article><Heart size={18} /><span>ذخیره‌ها</span><strong>{stats.favorites.toLocaleString("fa-IR")}</strong></article>
              <article><Bookmark size={18} /><span>جست‌وجوهای فعال</span><strong>{stats.searches.toLocaleString("fa-IR")}</strong></article>
              <article><FileText size={18} /><span>درخواست‌ها</span><strong>{stats.requests.toLocaleString("fa-IR")}</strong></article>
              <article><CalendarDays size={18} /><span>بازدیدها</span><strong>{stats.visits.toLocaleString("fa-IR")}</strong></article>
              <article><BellRing size={18} /><span>اعلان‌های جدید</span><strong>{stats.alerts.toLocaleString("fa-IR")}</strong></article>
            </section>

            {nextVisit ? (
              <section className="customer-dashboard-next">
                <CalendarDays size={21} />
                <div>
                  <span>بازدید پیش‌رو</span>
                  <strong>{nextVisit.propertyTitle || nextVisit.neighborhood || "فایل ملکی"}</strong>
                  <small>{formatDate(nextVisit.preferredAt!)} · {VISIT_LABEL[nextVisit.visitStatus] ?? nextVisit.visitStatus}</small>
                </div>
                {nextVisit.trackingToken ? (
                  <a href={"/request-tracking?token=" + encodeURIComponent(nextVisit.trackingToken)} className="btn-ghost">
                    پیگیری درخواست <ChevronLeft size={14} />
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="customer-dashboard-card">
              <div className="customer-dashboard-section-head">
                <div><span className="kicker"><Heart size={13} /> منتخب‌ها</span><h2>فایل‌های ذخیره‌شده</h2></div>
                <Link to="/favorites" className="btn-ghost">همه منتخب‌ها <ChevronLeft size={14} /></Link>
              </div>
              {favoriteLoading ? (
                <div className="customer-dashboard-empty compact"><RefreshCw size={22} className="admin-spin" /></div>
              ) : favoriteProperties.length ? (
                <div className="property-grid customer-dashboard-properties">
                  {favoriteProperties.slice(0, 6).map((property) => <PropertyCard key={property.id} property={property} />)}
                </div>
              ) : (
                <div className="customer-dashboard-empty compact">
                  <Heart size={25} />
                  <strong>هنوز فایلی ذخیره نشده</strong>
                  <Link to="/properties" className="btn-ghost">شروع جست‌وجو</Link>
                </div>
              )}
            </section>

            <div className="customer-dashboard-columns">
              <section className="customer-dashboard-card">
                <div className="customer-dashboard-section-head">
                  <div><span className="kicker"><Bookmark size={13} /> اعلان‌پذیری</span><h2>جست‌وجوهای فعال</h2></div>
                  <Link to="/properties" className="btn-ghost">فایل جدید <Search size={14} /></Link>
                </div>
                {searches.length ? (
                  <div className="customer-dashboard-searches">
                    {searches.map((item) => (
                      <article key={item.clientId}>
                        <div><Bookmark size={16} /><strong>{item.name}</strong></div>
                        <small>آخرین ویرایش: {formatDate(item.updatedAt)}</small>
                        <a href={searchHref(item.params)} className="customer-dashboard-inline-link">اجرای همین جست‌وجو <ChevronLeft size={12} /></a>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="customer-dashboard-empty compact"><Bookmark size={22} /><strong>جست‌وجوی فعالی ندارید.</strong><Link to="/properties" className="btn-ghost">ذخیره جست‌وجو</Link></div>
                )}
              </section>

              <section className="customer-dashboard-card">
                <div className="customer-dashboard-section-head">
                  <div><span className="kicker"><FileHeart size={13} /> CRM مشتری</span><h2>آخرین درخواست‌ها</h2></div>
                  <a href="/request-tracking" className="btn-ghost">پیگیری کد <ExternalLink size={14} /></a>
                </div>
                {requests.length ? (
                  <div className="customer-dashboard-requests">
                    {requests.slice(0, 8).map((item) => (
                      <article key={item.id}>
                        <div className="customer-dashboard-request-main">
                          <strong>{item.propertyTitle || item.deal || "درخواست ملکی"}</strong>
                          <small>{item.neighborhood || "محله ثبت نشده"} · {formatDate(item.createdAt)}</small>
                        </div>
                        <div className="customer-dashboard-request-badges">
                          <span>{STATUS_LABEL[item.status] ?? item.status}</span>
                          {item.visitStatus !== "none" ? <span>{VISIT_LABEL[item.visitStatus] ?? item.visitStatus}</span> : null}
                        </div>
                        {item.trackingToken ? (
                          <a
                            href={"/request-tracking?token=" + encodeURIComponent(item.trackingToken)}
                            className="customer-dashboard-inline-link"
                          >
                            مشاهده جزئیات و پیگیری <ChevronLeft size={12} />
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="customer-dashboard-empty compact"><FileText size={22} /><strong>هنوز درخواستی ثبت نکرده‌اید.</strong><Link to="/" hash="inquiry" className="btn-gold">ثبت درخواست</Link></div>
                )}
              </section>
            </div>

            <section className="customer-dashboard-tip">
              <Sparkles size={18} />
              <div>
                <strong>پیشنهاد هوشمند فعال است</strong>
                <p>از روی فایل‌های ذخیره‌شده و جست‌وجوهای فعال، گزینه‌های نزدیک‌تر در صفحه اصلی پیشنهاد می‌شوند.</p>
              </div>
              <Link to="/properties">مشاهده همه فایل‌ها <ChevronLeft size={14} /></Link>
            </section>
          </>
        )}
      </main>
    </SiteChrome>
  );
}
