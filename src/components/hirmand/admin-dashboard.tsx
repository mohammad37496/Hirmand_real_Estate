import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Eye,
  Phone,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";

type DashboardData = {
  properties: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    featured: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    follow_up: number;
    visited: number;
    contract: number;
    closed: number;
    spam: number;
    today: number;
    last7: number;
    last30: number;
  };
  propertyTypes: { type: string; count: number }[];
  leadDays: { day: string; count: number }[];
  music: { total: number; active: number };
  visitors: {
    today: number;
    last7: number;
    last30: number;
    pageviewsToday: number;
    pageviewsLast7: number;
    pageviewsLast30: number;
    activeNow: number;
  };
  visitorDays: {
    day: string;
    uniqueVisitors: number;
    pageviews: number;
  }[];
  topPages: {
    path: string;
    pageviews: number;
    uniqueVisitors: number;
  }[];
  topProperties: {
    slug: string;
    title: string;
    neighborhood: string;
    views: number;
    uniqueViews: number;
    calls: number;
    whatsapp: number;
    favorites: number;
  }[];
  eventStats: {
    event: string;
    count: number;
    uniqueVisitors: number;
  }[];
  visitorSources: {
    source: string;
    campaign: string;
    visitors: number;
  }[];
  followUps: { due: number; next7: number };
  recentLeads: {
    id: string;
    name: string;
    phone: string;
    deal: string;
    neighborhood: string;
    status: LeadStatus;
    createdAt: string;
  }[];
};

const TYPE_LABEL: Record<string, string> = {
  apartment: "آپارتمان",
  villa: "ویلا و باغ",
  office: "اداری",
  heritage: "خانه اصیل",
  land: "زمین",
  commercial: "تجاری",
  other: "سایر",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  follow_up: "پیگیری",
  visited: "بازدید",
  contract: "قرارداد",
  closed: "ناموفق / بسته",
  spam: "اسپم",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function tehranDateKey(offset = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const now = new Date();
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((item) => item.type === "year")?.value);
  const month = Number(parts.find((item) => item.type === "month")?.value);
  const day = Number(parts.find((item) => item.type === "day")?.value);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - offset);
  return formatter.format(utc);
}

function formatDay(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      weekday: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(value + "T12:00:00+03:30"));
  } catch {
    return value;
  }
}

export function AdminDashboard({
  onOpenProperties,
  onOpenLeads,
}: {
  onOpenProperties: () => void;
  onOpenLeads: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(result?.statusMessage || result?.message || "بارگذاری داشبورد انجام نشد.");
      }
      setData((await response.json()) as DashboardData);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری داشبورد انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const maxLeadDay = useMemo(() => Math.max(1, ...(data?.leadDays.map((item) => item.count) ?? [0])), [data]);
  const maxPropertyType = useMemo(
    () => Math.max(1, ...(data?.propertyTypes.map((item) => item.count) ?? [0])),
    [data],
  );
  const maxVisitorDay = useMemo(
    () => Math.max(1, ...(data?.visitorDays.map((item) => item.uniqueVisitors) ?? [0])),
    [data],
  );

  const last7Days = useMemo(() => {
    const map = new Map((data?.leadDays ?? []).map((item) => [item.day, item.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const key = tehranDateKey(6 - index);
      return { day: key, count: map.get(key) ?? 0 };
    });
  }, [data]);

  const conversion = useMemo(() => {
    const inquiry = data?.eventStats.find((item) => item.event === "inquiry_submit");
    const calls = data?.eventStats.find((item) => item.event === "call_click");
    const whatsapp = data?.eventStats.find((item) => item.event === "whatsapp_click");
    const rate =
      data?.visitors.last30 && inquiry
        ? (inquiry.uniqueVisitors / data.visitors.last30) * 100
        : 0;
    const pagesPerVisitor =
      data?.visitors.last30
        ? data.visitors.pageviewsLast30 / data.visitors.last30
        : 0;
    return {
      inquiryVisitors: inquiry?.uniqueVisitors ?? 0,
      calls: calls?.count ?? 0,
      whatsapp: whatsapp?.count ?? 0,
      rate,
      pagesPerVisitor,
    };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="admin-dashboard">
        <section className="admin-panel">
          <div className="admin-empty">
            <RefreshCw size={26} className="admin-spin" />
            <strong>در حال ساخت داشبورد...</strong>
            <p>آمار فایل‌ها و درخواست‌های مشتری از دیتابیس خوانده می‌شود.</p>
          </div>
        </section>
      </div>
    );
  }

  const stats = [
    { label: "کل فایل‌ها", value: data.properties.total, icon: Building2, tone: "gold" },
    { label: "بازدید امروز", value: data.visitors.today, icon: Eye, tone: "blue" },
    { label: "فایل‌های منتشرشده", value: data.properties.published, icon: BarChart3, tone: "green" },
    { label: "درخواست‌های جدید", value: data.leads.new, icon: UsersRound, tone: "amber" },
    { label: "لید در ۳۰ روز", value: data.leads.last30, icon: UserRound, tone: "blue" },
  ] as const;

  const leadStatuses = [
    { key: "new" as const, label: "جدید", value: data.leads.new, tone: "gold" },
    { key: "contacted" as const, label: "تماس گرفته شد", value: data.leads.contacted, tone: "blue" },
    { key: "follow_up" as const, label: "پیگیری", value: data.leads.follow_up, tone: "amber" },
    { key: "visited" as const, label: "بازدید", value: data.leads.visited, tone: "violet" },
    { key: "contract" as const, label: "قرارداد", value: data.leads.contract, tone: "green" },
    { key: "closed" as const, label: "ناموفق / بسته", value: data.leads.closed, tone: "red" },
    { key: "spam" as const, label: "اسپم", value: data.leads.spam, tone: "red" },
  ];

  return (
    <div className="admin-dashboard">
      <style>{`.admin-funnel-row{display:flex;flex-direction:column}`}</style>
      <div className="admin-dashboard-stats">
        <button type="button" className="admin-dashboard-stat" data-tone="red" onClick={onOpenLeads}>
          <span className="admin-dashboard-stat-icon"><Phone size={19} /></span>
          <span>
            <small>پیگیری‌های سررسیدشده</small>
            <strong>{data.followUps.due.toLocaleString("fa-IR")}</strong>
          </span>
          <ArrowLeft size={16} />
        </button>
        <div className="admin-dashboard-stat" data-tone="green">
          <span className="admin-dashboard-stat-icon"><RefreshCw size={19} /></span>
          <span>
            <small>پیگیری در ۷ روز آینده</small>
            <strong>{data.followUps.next7.toLocaleString("fa-IR")}</strong>
          </span>
        </div>
        {stats.map(({ label, value, icon: Icon, tone }) => {
          const action = label.includes("درخواست") || label.includes("لید")
            ? onOpenLeads
            : label.includes("فایل")
              ? onOpenProperties
              : undefined;

          return (
            <button
              key={label}
              type="button"
              className="admin-dashboard-stat"
              data-tone={tone}
              onClick={action}
              disabled={!action}
            >
              <span className="admin-dashboard-stat-icon"><Icon size={19} /></span>
              <span>
                <small>{label}</small>
                <strong>{value.toLocaleString("fa-IR")}</strong>
              </span>
              {action ? <ArrowLeft size={16} /> : null}
            </button>
          );
        })}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">CRM</span>
              <h2>قیف درخواست‌ها</h2>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="admin-dashboard-summary">
                {lastUpdated ? "آخرین بروزرسانی " + lastUpdated.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "در حال بروزرسانی"}
              </span>
              <button type="button" className="btn-ghost" onClick={() => void load()}>بروزرسانی</button>
              <button type="button" className="btn-ghost" onClick={onOpenLeads}>مشاهده همه</button>
            </div>
          </div>
          <div className="admin-funnel">
            {leadStatuses.map((item) => (
              <div key={item.key} className="admin-funnel-row">
                <div className="admin-funnel-label">
                  <span>{item.label}</span>
                  <strong>{item.value.toLocaleString("fa-IR")}</strong>
                </div>
                <div className="admin-funnel-track">
                  <span data-tone={item.tone} style={{ width: (data.leads.total ? Math.max(4, (item.value / data.leads.total) * 100) : 4) + "%" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="admin-dashboard-mini-grid">
            <div><span>امروز</span><strong>{data.leads.today.toLocaleString("fa-IR")}</strong></div>
            <div><span>۷ روز اخیر</span><strong>{data.leads.last7.toLocaleString("fa-IR")}</strong></div>
            <div><span>۳۰ روز اخیر</span><strong>{data.leads.last30.toLocaleString("fa-IR")}</strong></div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">موجودی</span>
              <h2>ترکیب فایل‌ها</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={onOpenProperties}>فهرست فایل‌ها</button>
          </div>
          <div className="admin-breakdown">
            {data.propertyTypes.length === 0 ? (
              <div className="admin-empty"><Building2 size={24} /><strong>هنوز فایلی ثبت نشده</strong></div>
            ) : data.propertyTypes.map((item) => (
              <div key={item.type} className="admin-breakdown-row">
                <div><span>{TYPE_LABEL[item.type] ?? item.type}</span><strong>{item.count.toLocaleString("fa-IR")}</strong></div>
                <div className="admin-breakdown-track">
                  <span style={{ width: Math.max(5, (item.count / maxPropertyType) * 100) + "%" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="admin-dashboard-mini-grid">
            <div><span>ویژه</span><strong>{data.properties.featured.toLocaleString("fa-IR")}</strong></div>
            <div><span>پیش‌نویس</span><strong>{data.properties.draft.toLocaleString("fa-IR")}</strong></div>
            <div><span>بایگانی</span><strong>{data.properties.archived.toLocaleString("fa-IR")}</strong></div>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">روند</span>
            <h2>ورودی لید در ۷ روز اخیر</h2>
          </div>
          <span className="admin-dashboard-summary">{data.leads.last7.toLocaleString("fa-IR")} درخواست</span>
        </div>
        <div className="admin-lead-chart">
          {last7Days.map((item) => (
            <div key={item.day} className="admin-lead-chart-col">
              <div className="admin-lead-chart-value">{item.count ? item.count.toLocaleString("fa-IR") : "۰"}</div>
              <div className="admin-lead-chart-bar-wrap">
                <span style={{ height: Math.max(item.count ? 12 : 4, (item.count / maxLeadDay) * 100) + "%" }} />
              </div>
              <small>{formatDay(item.day)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">آنالیز سایت</span>
            <h2>بازدیدکننده‌های سایت</h2>
          </div>
          <span className="admin-dashboard-summary">
            امروز {data.visitors.today.toLocaleString("fa-IR")} نفر
          </span>
        </div>

        <div className="admin-dashboard-mini-grid">
          <div>
            <span>فعال در ۵ دقیقه اخیر</span>
            <strong>{data.visitors.activeNow.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>بازدیدکننده امروز</span>
            <strong>{data.visitors.today.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>بازدیدکننده ۷ روز</span>
            <strong>{data.visitors.last7.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>بازدیدکننده ۳۰ روز</span>
            <strong>{data.visitors.last30.toLocaleString("fa-IR")}</strong>
          </div>
        </div>

        <div className="admin-dashboard-mini-grid">
          <div>
            <span>نرخ تبدیل به درخواست</span>
            <strong>{conversion.rate.toFixed(1)}٪</strong>
          </div>
          <div>
            <span>کلیک تماس</span>
            <strong>{conversion.calls.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>کلیک واتساپ</span>
            <strong>{conversion.whatsapp.toLocaleString("fa-IR")}</strong>
          </div>
        </div>

        <div className="admin-dashboard-mini-grid">
          <div>
            <span>نمایش صفحه امروز</span>
            <strong>{data.visitors.pageviewsToday.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>نمایش صفحه ۷ روز</span>
            <strong>{data.visitors.pageviewsLast7.toLocaleString("fa-IR")}</strong>
          </div>
          <div>
            <span>نمایش صفحه ۳۰ روز</span>
            <strong>{data.visitors.pageviewsLast30.toLocaleString("fa-IR")}</strong>
          </div>
        </div>

        <div className="admin-lead-chart" aria-label="روند بازدیدکننده‌ها در ۱۴ روز اخیر">
          {data.visitorDays.map((item) => (
            <div key={item.day} className="admin-lead-chart-col">
              <div className="admin-lead-chart-value">
                {item.uniqueVisitors.toLocaleString("fa-IR")}
              </div>
              <div className="admin-lead-chart-bar-wrap">
                <span
                  style={{
                    height:
                      Math.max(
                        item.uniqueVisitors ? 12 : 4,
                        (item.uniqueVisitors / maxVisitorDay) * 100,
                      ) + "%",
                  }}
                />
              </div>
              <small>{formatDay(item.day)}</small>
            </div>
          ))}
        </div>

        <p className="admin-dashboard-summary">
          میانگین نمایش صفحه برای هر بازدیدکننده در ۳۰ روز: {conversion.pagesPerVisitor.toFixed(1)} صفحه.
          «بازدیدکننده» بر اساس یک شناسه ناشناس در کوکی همان مرورگر محاسبه می‌شود؛ حذف کوکی یا تعویض مرورگر می‌تواند یک نفر را دوباره به‌عنوان بازدیدکننده جدید ثبت کند.
        </p>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">فایل‌های محبوب</span>
              <h2>پربازدیدترین فایل‌ها</h2>
            </div>
            <span className="admin-dashboard-summary">۳۰ روز اخیر</span>
          </div>
          <div className="admin-breakdown">
            {data.topProperties.length === 0 ? (
              <div className="admin-empty">
                <Building2 size={24} />
                <strong>هنوز بازدید فایل ثبت نشده</strong>
              </div>
            ) : (
              data.topProperties.map((item) => (
                <div key={item.slug} className="admin-breakdown-row">
                  <div>
                    <span>
                      {item.title}
                      {item.neighborhood ? " · " + item.neighborhood : ""}
                    </span>
                    <strong>{item.views.toLocaleString("fa-IR")}</strong>
                  </div>
                  <small>
                    {item.uniqueViews.toLocaleString("fa-IR")} نفر ·{" "}
                    {item.calls.toLocaleString("fa-IR")} تماس ·{" "}
                    {item.whatsapp.toLocaleString("fa-IR")} واتساپ ·{" "}
                    {item.favorites.toLocaleString("fa-IR")} ذخیره
                  </small>
                  <a
                    href={`/properties/${encodeURIComponent(item.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    مشاهده
                  </a>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">صفحات</span>
              <h2>پربازدیدترین صفحات</h2>
            </div>
            <span className="admin-dashboard-summary">۳۰ روز اخیر</span>
          </div>
          <div className="admin-breakdown">
            {data.topPages.length === 0 ? (
              <div className="admin-empty">
                <BarChart3 size={24} />
                <strong>هنوز داده‌ای ثبت نشده</strong>
              </div>
            ) : (
              data.topPages.map((item) => (
                <div key={item.path} className="admin-breakdown-row">
                  <div>
                    <span dir="ltr">{item.path}</span>
                    <strong>{item.pageviews.toLocaleString("fa-IR")}</strong>
                  </div>
                  <small>
                    {item.uniqueVisitors.toLocaleString("fa-IR")} بازدیدکننده
                  </small>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">تبدیل</span>
              <h2>اقدام‌های مهم کاربران</h2>
            </div>
            <span className="admin-dashboard-summary">۳۰ روز اخیر</span>
          </div>
          <div className="admin-breakdown">
            {data.eventStats.length === 0 ? (
              <div className="admin-empty">
                <UsersRound size={24} />
                <strong>هنوز رویدادی ثبت نشده</strong>
              </div>
            ) : (
              data.eventStats.map((item) => {
                const labels: Record<string, string> = {
                  call_click: "کلیک تماس",
                  whatsapp_click: "کلیک واتساپ",
                  inquiry_submit: "ثبت درخواست",
                  inquiry_click: "باز کردن فرم درخواست",
                  property_share: "اشتراک فایل",
                  property_favorite: "ذخیره فایل",
                  property_view: "بازدید فایل",
                  property_compare: "افزودن به مقایسه",
                  search_share: "اشتراک جست‌وجو",
                  property_search: "جست‌وجوی فایل",
                };
                return (
                  <div key={item.event} className="admin-breakdown-row">
                    <div>
                      <span>{labels[item.event] ?? item.event}</span>
                      <strong>{item.count.toLocaleString("fa-IR")}</strong>
                    </div>
                    <small>
                      {item.uniqueVisitors.toLocaleString("fa-IR")} نفر
                    </small>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">پیگیری</span>
            <h2>آخرین درخواست‌ها</h2>
          </div>
          <button type="button" className="btn-ghost" onClick={onOpenLeads}>مدیریت CRM</button>
        </div>
        {data.recentLeads.length === 0 ? (
          <div className="admin-empty">
            <UsersRound size={26} />
            <strong>هنوز لید جدیدی ندارید</strong>
            <p>درخواست‌های فرم سایت در این بخش نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div className="admin-recent-leads">
            {data.recentLeads.map((lead) => (
              <article key={lead.id} className="admin-recent-lead">
                <div className="admin-recent-lead-icon"><UserRound size={17} /></div>
                <div className="admin-recent-lead-main">
                  <div className="admin-recent-lead-title">
                    <strong>{lead.name}</strong>
                    <span className={"admin-lead-status status-" + lead.status}>{STATUS_LABEL[lead.status]}</span>
                  </div>
                  <small>
                    {lead.deal}
                    {lead.neighborhood ? " · " + lead.neighborhood : ""}
                    {" · " + formatDate(lead.createdAt)}
                  </small>
                </div>
                <a className="admin-icon-btn" href={"tel:" + lead.phone} title="تماس">
                  <Phone size={16} />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>


    </div>
  );
}
