import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarRange, CheckCircle2, Eye, Filter, PhoneCall, RefreshCw, Target, UsersRound } from "lucide-react";

type Row = {
  source: string;
  medium: string;
  campaign: string;
  leads: number;
  contacted: number;
  visits: number;
  contracts: number;
  contactRate: number;
  contractRate: number;
};
type Data = {
  days: 7 | 30 | 90;
  rows: Row[];
  totals: { campaigns: number; leads: number; contacted: number; visits: number; contracts: number };
};

const fa = (value: number) => value.toLocaleString("fa-IR");
const pct = (value: number) => value.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪";

export function AdminCampaignPerformance() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: 7 | 30 | 90) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-campaign-performance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: range }),
      });
      const result = (await response.json().catch(() => null)) as Data | { statusMessage?: string } | null;
      if (!response.ok) throw new Error(result && "statusMessage" in result ? result.statusMessage : "گزارش کمپین‌ها در دسترس نیست.");
      setData(result as Data);
    } catch {
      setData({ days: range, rows: [], totals: { campaigns: 0, leads: 0, contacted: 0, visits: 0, contracts: 0 } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <section className="admin-panel admin-campaign-performance" style={{ marginTop: 18 }} aria-label="عملکرد کمپین‌های بازاریابی">
      <style>{`
        .admin-campaign-performance{overflow:hidden}
        .admin-campaign-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
        .admin-campaign-title{display:grid;gap:4px}.admin-campaign-title h2{margin:4px 0 0;color:var(--navy-900);font-size:1.06rem}.admin-campaign-title p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.8}
        .admin-campaign-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.admin-campaign-range{display:inline-flex;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2,#f7f5f0)}
        .admin-campaign-range button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.65rem;font-weight:800;padding:6px 8px;border-radius:8px;cursor:pointer}.admin-campaign-range button.is-active{background:var(--card,#fff);color:var(--navy-900)}
        .admin-campaign-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:13px 0}.admin-campaign-stat{display:grid;gap:4px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--card,#fff)}.admin-campaign-stat span{color:var(--muted);font-size:.63rem}.admin-campaign-stat strong{color:var(--navy-900);font-size:1rem}
        .admin-campaign-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:13px}.admin-campaign-table{width:100%;min-width:780px;border-collapse:collapse}.admin-campaign-table th,.admin-campaign-table td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right}.admin-campaign-table th{background:var(--surface-2,#f7f5f0);color:var(--subtle);font-size:.62rem;white-space:nowrap}.admin-campaign-table td{color:var(--muted);font-size:.67rem}.admin-campaign-table tr:last-child td{border-bottom:0}
        .admin-campaign-name strong{display:block;color:var(--navy-900);font-size:.7rem}.admin-campaign-name small{display:block;color:var(--subtle);font-size:.6rem;margin-top:2px}.admin-campaign-number{font-weight:800;color:var(--navy-900)!important}.admin-campaign-rate{display:inline-flex;padding:3px 6px;border-radius:8px;background:var(--surface-2,#f7f5f0);color:var(--navy-900);font-weight:800}
        .admin-campaign-empty{padding:24px;text-align:center;color:var(--subtle)}.admin-campaign-note{margin:8px 0 0;color:var(--subtle);font-size:.61rem;line-height:1.8}
        @media(max-width:900px){.admin-campaign-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.admin-campaign-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
      <div className="admin-campaign-head">
        <div className="admin-campaign-title">
          <span className="kicker">بازاریابی</span>
          <h2>عملکرد کمپین‌ها و منابع جذب</h2>
          <p>تعداد لید، تماس، بازدید و قرارداد ثبت‌شده را به تفکیک منبع، رسانه و کمپین ببینید.</p>
        </div>
        <div className="admin-campaign-toolbar">
          <div className="admin-campaign-range" aria-label="بازه گزارش">
            {[7,30,90].map((value) => <button key={value} type="button" className={days === value ? "is-active" : ""} onClick={() => setDays(value as 7|30|90)}>{value === 7 ? "۷ روز" : value === 30 ? "۳۰ روز" : "۹۰ روز"}</button>)}
          </div>
          <button type="button" className="btn-ghost" onClick={() => void load(days)} disabled={loading}><RefreshCw size={14} className={loading ? "admin-spin" : ""}/>بروزرسانی</button>
        </div>
      </div>
      <div className="admin-campaign-grid">
        <div className="admin-campaign-stat"><span><Target size={12}/>تعداد گروه‌های جذب</span><strong>{fa(data?.totals.campaigns ?? 0)}</strong></div>
        <div className="admin-campaign-stat"><span><UsersRound size={12}/>لید</span><strong>{fa(data?.totals.leads ?? 0)}</strong></div>
        <div className="admin-campaign-stat"><span><PhoneCall size={12}/>تماس گرفته‌شده</span><strong>{fa(data?.totals.contacted ?? 0)}</strong></div>
        <div className="admin-campaign-stat"><span><CalendarRange size={12}/>بازدید</span><strong>{fa(data?.totals.visits ?? 0)}</strong></div>
        <div className="admin-campaign-stat"><span><CheckCircle2 size={12}/>قرارداد</span><strong>{fa(data?.totals.contracts ?? 0)}</strong></div>
      </div>
      <div className="admin-campaign-table-wrap">
        {loading && !data ? <div className="admin-campaign-empty"><RefreshCw size={22} className="admin-spin"/>در حال جمع‌آوری داده‌ها…</div> : data?.rows.length ? (
          <table className="admin-campaign-table">
            <thead><tr><th>منبع / کمپین</th><th>لید</th><th>تماس</th><th>بازدید</th><th>قرارداد</th><th>نرخ تماس</th><th>نرخ قرارداد</th></tr></thead>
            <tbody>{data.rows.map((row) => (
              <tr key={row.source + "|" + row.medium + "|" + row.campaign}>
                <td className="admin-campaign-name"><strong>{row.campaign}</strong><small>{row.source} · {row.medium}</small></td>
                <td className="admin-campaign-number">{fa(row.leads)}</td><td className="admin-campaign-number">{fa(row.contacted)}</td><td className="admin-campaign-number">{fa(row.visits)}</td><td className="admin-campaign-number">{fa(row.contracts)}</td>
                <td><span className="admin-campaign-rate">{pct(row.contactRate)}</span></td><td><span className="admin-campaign-rate">{pct(row.contractRate)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="admin-campaign-empty"><BarChart3 size={24}/>برای این بازه داده کمپین ثبت نشده است.</div>}
      </div>
      <p className="admin-campaign-note">این گزارش «بازده قیف جذب» است؛ چون مبلغ قرارداد به کمپین متصل نیست، عدد مالی ROI محاسبه نمی‌شود.</p>
    </section>
  );
}
