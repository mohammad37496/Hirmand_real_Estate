import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, FileText, RefreshCw, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { SITE } from "@/lib/site";
import "@/request-tracking.css";

type TrackingResponse = {
  enabled?: boolean;
  found?: boolean;
  request?: {
    token: string;
    status: string;
    statusLabel: string;
    visitStatus: string;
    visitStatusLabel: string;
    deal: string;
    propertyType: string;
    neighborhood: string;
    propertyTitle: string;
    propertySlug: string;
    preferredAt: string | null;
    createdAt: string;
  };
  activities?: Array<{ type: string; title: string; note: string; createdAt: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const Route = createFileRoute("/request-tracking")({
  head: () => ({
    meta: [
      { title: `پیگیری درخواست | ${SITE.nameFa}` },
      { name: "description", content: "پیگیری وضعیت درخواست و هماهنگی بازدید در هیرمند." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RequestTrackingPage,
});

function RequestTrackingPage() {
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    setToken(value);
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      setData({ enabled: true, found: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/request-tracking?token=" + encodeURIComponent(token), {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null) as TrackingResponse | null;
      if (!response.ok) throw new Error(result?.request?.statusLabel || "کد پیگیری معتبر نیست.");
      setData(result);
    } catch {
      setData({ enabled: true, found: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const request = data?.request;
  const activities = data?.activities ?? [];

  const statusClass = useMemo(() => {
    if (!request) return "";
    if (request.status === "contract") return "is-contract";
    if (request.status === "closed" || request.status === "spam") return "is-closed";
    if (request.visitStatus === "confirmed") return "is-confirmed";
    return "is-active";
  }, [request]);

  return (
    <SiteChrome className="request-tracking-shell">
      <main className="request-tracking-page">
        <header className="request-tracking-head">
          <div>
            <span className="kicker">سرویس پیگیری مشتری</span>
            <h1>وضعیت درخواست شما</h1>
            <p>کد پیگیری را از پیام ثبت درخواست وارد کرده‌اید؛ وضعیت اینجا از اطلاعات CRM هیرمند خوانده می‌شود.</p>
          </div>
          <FileText size={34} aria-hidden="true" />
        </header>

        {loading ? (
          <section className="request-tracking-card request-tracking-empty">
            <RefreshCw size={24} className="admin-spin" />
            <strong>در حال دریافت آخرین وضعیت…</strong>
          </section>
        ) : !data?.enabled ? (
          <section className="request-tracking-card request-tracking-empty">
            <SearchX size={26} />
            <strong>سامانه پیگیری آنلاین فعلاً فعال نیست.</strong>
            <Link to="/" className="btn-gold">بازگشت به سایت</Link>
          </section>
        ) : !request ? (
          <section className="request-tracking-card request-tracking-empty">
            <SearchX size={28} />
            <strong>درخواستی با این کد پیدا نشد.</strong>
            <p>کد را دقیق وارد کنید یا از لینک مستقیم داخل پیام ثبت درخواست استفاده کنید.</p>
            <Link to="/" className="btn-gold">بازگشت به سایت</Link>
          </section>
        ) : (
          <>
            <section className="request-tracking-card">
              <div className={"request-tracking-status " + statusClass}>
                <CheckCircle2 size={24} />
                <div>
                  <span>وضعیت درخواست</span>
                  <strong>{request.statusLabel}</strong>
                </div>
              </div>

              <div className="request-tracking-grid">
                <div><span>کد پیگیری</span><strong dir="ltr">{request.token}</strong></div>
                <div><span>نوع درخواست</span><strong>{request.deal || "مشاوره ملکی"}</strong></div>
                <div><span>محله</span><strong>{request.neighborhood || "—"}</strong></div>
                <div><span>نوع ملک</span><strong>{request.propertyType || "—"}</strong></div>
                <div><span>ثبت درخواست</span><strong>{formatDate(request.createdAt)}</strong></div>
                <div><span>وضعیت بازدید</span><strong>{request.visitStatusLabel}</strong></div>
              </div>

              {request.propertyTitle ? (
                <div className="request-tracking-property">
                  <div>
                    <span className="kicker">فایل مرتبط</span>
                    <strong>{request.propertyTitle}</strong>
                  </div>
                  {request.propertySlug ? (
                    <a href={"/properties/" + request.propertySlug} className="btn-ghost">
                      <ExternalLink size={14} /> مشاهده فایل
                    </a>
                  ) : null}
                </div>
              ) : null}

              {request.preferredAt ? (
                <div className="request-tracking-visit">
                  <CalendarDays size={18} />
                  <div>
                    <span>زمان پیشنهادی بازدید</span>
                    <strong>{formatDate(request.preferredAt)}</strong>
                  </div>
                  <Clock3 size={17} />
                </div>
              ) : null}
            </section>

            <section className="request-tracking-card">
              <div className="request-tracking-section-head">
                <div>
                  <span className="kicker">تاریخچه</span>
                  <h2>آخرین به‌روزرسانی‌ها</h2>
                </div>
                <button type="button" className="btn-ghost" onClick={() => void load()}>
                  <RefreshCw size={14} /> تازه‌سازی
                </button>
              </div>
              {activities.length ? (
                <div className="request-tracking-timeline">
                  {activities.map((activity) => (
                    <article key={activity.createdAt + activity.title} className="request-tracking-event">
                      <span className="request-tracking-dot" />
                      <div>
                        <strong>{activity.title}</strong>
                        {activity.note ? <p>{activity.note}</p> : null}
                        <small>{formatDate(activity.createdAt)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="request-tracking-empty-line">هنوز رویداد جدیدی برای نمایش ثبت نشده است.</div>
              )}
            </section>
          </>
        )}
      </main>
    </SiteChrome>
  );
}
