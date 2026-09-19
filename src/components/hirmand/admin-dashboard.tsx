import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Clock3,
  Headphones,
  Phone,
  RefreshCw,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

type LeadStatus = "new" | "contacted" | "closed" | "spam";

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
    closed: number;
    spam: number;
    today: number;
    last7: number;
    last30: number;
  };
  propertyTypes: { type: string; count: number }[];
  leadDays: { day: string; count: number }[];
  music: { total: number; active: number };
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
  contacted: "پیگیری",
  closed: "بسته",
  spam: "اسپم",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDay(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(new Date(value + "T12:00:00"));
  } catch {
    return value;
  }
}

export function AdminDashboard({
  adminKey,
  onOpenProperties,
  onOpenLeads,
}: {
  adminKey: string;
  onOpenProperties: () => void;
  onOpenLeads: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminKey }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { statusMessage?: string } | null;
        throw new Error(result?.statusMessage || "بارگذاری داشبورد انجام نشد.");
      }
      setData((await response.json()) as DashboardData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری داشبورد انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxLeadDay = useMemo(() => Math.max(1, ...(data?.leadDays.map((item) => item.count) ?? [0])), [data]);
  const maxPropertyType = useMemo(
    () => Math.max(1, ...(data?.propertyTypes.map((item) => item.count) ?? [0])),
    [data],
  );

  const last7Days = useMemo(() => {
    const map = new Map((data?.leadDays ?? []).map((item) => [item.day, item.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(12, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { day: key, count: map.get(key) ?? 0 };
    });
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
    { label: "فایل‌های منتشرشده", value: data.properties.published, icon: BarChart3, tone: "green" },
    { label: "درخواست‌های جدید", value: data.leads.new, icon: UsersRound, tone: "amber" },
    { label: "لید در ۳۰ روز", value: data.leads.last30, icon: UserRound, tone: "blue" },
  ] as const;

  const leadStatuses = [
    { key: "new" as const, label: "جدید", value: data.leads.new, tone: "gold" },
    { key: "contacted" as const, label: "در حال پیگیری", value: data.leads.contacted, tone: "blue" },
    { key: "closed" as const, label: "بسته‌شده", value: data.leads.closed, tone: "green" },
    { key: "spam" as const, label: "اسپم", value: data.leads.spam, tone: "red" },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-actions">
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          <RefreshCw size={15} />
          به‌روزرسانی
        </button>
        <button type="button" className="btn-gold" onClick={onOpenProperties}>
          <Building2 size={15} />
          مدیریت فایل‌ها
        </button>
      </div>

      <div className="admin-dashboard-stats">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <button key={label} type="button" className="admin-dashboard-stat" data-tone={tone} onClick={label.includes("درخواست") || label.includes("لید") ? onOpenLeads : onOpenProperties}>
            <span className="admin-dashboard-stat-icon"><Icon size={19} /></span>
            <span>
              <small>{label}</small>
              <strong>{value.toLocaleString("fa-IR")}</strong>
            </span>
            <ArrowLeft size={16} />
          </button>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">CRM</span>
              <h2>قیف درخواست‌ها</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={onOpenLeads}>مشاهده همه</button>
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

      <section className="admin-dashboard-footer-cards">
        <div className="admin-dashboard-footer-card">
          <span><Headphones size={17} /> موسیقی سایت</span>
          <strong>{data.music.active.toLocaleString("fa-IR")} فعال</strong>
          <small>{data.music.total.toLocaleString("fa-IR")} ترک در کتابخانه</small>
        </div>
        <div className="admin-dashboard-footer-card">
          <span><Star size={17} /> فایل‌های ویژه</span>
          <strong>{data.properties.featured.toLocaleString("fa-IR")} فایل</strong>
          <small>برای نمایش برجسته در سایت</small>
        </div>
        <div className="admin-dashboard-footer-card">
          <span><Clock3 size={17} /> آخرین وضعیت</span>
          <strong>{data.leads.today.toLocaleString("fa-IR")} لید امروز</strong>
          <small>بر اساس زمان ثبت در دیتابیس</small>
        </div>
      </section>
    </div>
  );
}
