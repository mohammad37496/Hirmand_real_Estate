import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, Eye, Heart, MessageCircle, Phone, RefreshCw, Share2, UsersRound } from "lucide-react";
import { toast } from "sonner";

type PerformanceData = {
  windowDays: number;
  property: {
    id: string;
    slug: string;
    title: string;
    status: string;
    availabilityStatus: string;
  } | null;
  events: {
    property_view: number;
    property_favorite: number;
    property_share: number;
    property_compare: number;
    call_click: number;
    whatsapp_click: number;
    property_price_watch: number;
    visit_request: number;
    visit_request_click: number;
  };
  uniqueVisitors: number;
  leads: {
    total: number;
    visitRequests: number;
    confirmedVisits: number;
    completedVisits: number;
  };
  conversionRate: number;
};

function fa(value: number) {
  return value.toLocaleString("fa-IR");
}

const METRICS = [
  { key: "property_view", label: "بازدید فایل", icon: Eye },
  { key: "property_favorite", label: "ذخیره", icon: Heart },
  { key: "call_click", label: "تماس", icon: Phone },
  { key: "whatsapp_click", label: "واتساپ", icon: MessageCircle },
  { key: "property_share", label: "اشتراک", icon: Share2 },
  { key: "visit_request", label: "درخواست بازدید", icon: CalendarDays },
] as const;

export function AdminPropertyPerformance({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin-property-performance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ propertyId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.statusMessage || payload?.message || "گزارش عملکرد فایل بارگذاری نشد.");
      }
      setData(payload as PerformanceData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "گزارش عملکرد فایل بارگذاری نشد.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <fieldset className="admin-section admin-property-performance">
      <legend>عملکرد فایل در ۳۰ روز اخیر</legend>
      <div className="admin-property-performance-head">
        <div>
          <span className="kicker">دید و تبدیل</span>
          <h2>{data?.property?.title ?? "گزارش تعامل فایل"}</h2>
          <p>این گزارش فقط داده‌های عمومی تعامل کاربران با همین فایل را نشان می‌دهد.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "admin-spin" : ""} />
          بروزرسانی
        </button>
      </div>

      {loading && !data ? (
        <div className="admin-property-performance-skeleton" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </div>
      ) : data ? (
        <>
          <div className="admin-property-performance-grid">
            {METRICS.map(({ key, label, icon: Icon }) => (
              <div className="admin-property-performance-stat" key={key}>
                <span><Icon size={15} />{label}</span>
                <strong>{fa(data.events[key])}</strong>
              </div>
            ))}
            <div className="admin-property-performance-stat is-accent">
              <span><UsersRound size={15} />بازدیدکننده یکتا</span>
              <strong>{fa(data.uniqueVisitors)}</strong>
            </div>
            <div className="admin-property-performance-stat is-accent">
              <span><BarChart3 size={15} />تبدیل بازدید به لید</span>
              <strong>{fa(data.conversionRate)}٪</strong>
            </div>
          </div>

          <div className="admin-property-performance-funnel">
            <div><span>کل لیدهای این فایل</span><strong>{fa(data.leads.total)}</strong></div>
            <div><span>درخواست بازدید</span><strong>{fa(data.leads.visitRequests)}</strong></div>
            <div><span>بازدید تأییدشده</span><strong>{fa(data.leads.confirmedVisits)}</strong></div>
            <div><span>بازدید انجام‌شده</span><strong>{fa(data.leads.completedVisits)}</strong></div>
          </div>

          <p className="admin-field-help" style={{ marginTop: 12 }}>
            بازه محاسبه: ۳۰ روز گذشته · آمار تماس، واتساپ، ذخیره و اشتراک بر اساس رویدادهای ثبت‌شده سایت است.
          </p>
        </>
      ) : (
        <div className="admin-empty">گزارش این فایل در دسترس نیست.</div>
      )}
    </fieldset>
  );
}
