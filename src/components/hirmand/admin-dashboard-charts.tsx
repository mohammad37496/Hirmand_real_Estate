import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PROPERTY_TYPES } from "@/lib/site";
import type { Property, PropertyTransaction } from "@/lib/properties";
import { formatToman } from "@/lib/money";

const TX_LABEL: Record<PropertyTransaction, string> = {
  sell: "فروش",
  buy: "خرید",
  rent: "اجاره",
  mortgage: "رهن",
};

const CHART_COLORS = ["#c9a24a", "#3dd68c", "#5b8def", "#f5c542", "#e07a7a", "#9b7ed9"];
const FA_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const CHART_CSS = `
.admin-charts-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:16px}
.admin-chart-card{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.75);border-radius:18px;padding:18px 16px 12px;min-height:300px}
.admin-chart-card h3{margin:0 0 4px;font-size:.95rem;font-weight:700}
.admin-chart-card .chart-sub{margin:0 0 14px;color:#7d766c;font-size:.78rem}
.admin-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.admin-sell-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}
.admin-sell-stat{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.9);border-radius:16px;padding:16px}
.admin-sell-stat span{display:block;color:#7d766c;font-size:.78rem;font-weight:600;margin-bottom:6px}
.admin-sell-stat strong{font-size:1.4rem;font-weight:700;color:#e0c47a}
.admin-sell-stat[data-tone=green] strong{color:#3dd68c}
.admin-sell-stat[data-tone=muted] strong{color:#9aa3b2}
.admin-sell-stat[data-tone=amber] strong{color:#f5c542;font-size:1.05rem}
.admin-chart-empty{text-align:center;padding:40px 16px;color:#7d766c}
@media (max-width:960px){
  .admin-charts-grid,.admin-charts-row,.admin-sell-stats{grid-template-columns:1fr 1fr}
}
@media (max-width:520px){
  .admin-charts-grid,.admin-charts-row,.admin-sell-stats{grid-template-columns:1fr}
}
`;

type Props = {
  properties: Property[];
};

export function AdminDashboardCharts({ properties }: Props) {
  const stats = useMemo(() => {
    const published = properties.filter((p) => p.status === "published").length;
    const draft = properties.filter((p) => p.status === "draft").length;
    const archived = properties.filter((p) => p.status === "archived").length;
    return { published, draft, archived, total: properties.length };
  }, [properties]);

  const monthlyChart = useMemo(() => {
    const now = new Date();
    const buckets: {
      key: string;
      label: string;
      created: number;
      published: number;
      archived: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const faIdx = (d.getMonth() + 9) % 12;
      buckets.push({ key, label: FA_MONTHS[faIdx], created: 0, published: 0, archived: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const p of properties) {
      const created = new Date(p.createdAt);
      const cKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const cBucket = map.get(cKey);
      if (cBucket) cBucket.created += 1;

      if (p.publishedAt) {
        const pub = new Date(p.publishedAt);
        const pKey = `${pub.getFullYear()}-${String(pub.getMonth() + 1).padStart(2, "0")}`;
        const pBucket = map.get(pKey);
        if (pBucket) pBucket.published += 1;
      }
      if (p.status === "archived") {
        const u = new Date(p.updatedAt);
        const uKey = `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, "0")}`;
        const uBucket = map.get(uKey);
        if (uBucket) uBucket.archived += 1;
      }
    }
    return buckets;
  }, [properties]);

  const byTransaction = useMemo(() => {
    const counts: Record<PropertyTransaction, number> = {
      sell: 0,
      buy: 0,
      rent: 0,
      mortgage: 0,
    };
    for (const p of properties) counts[p.transactionType] += 1;
    return (Object.keys(counts) as PropertyTransaction[])
      .map((k) => ({ name: TX_LABEL[k], value: counts[k] }))
      .filter((x) => x.value > 0);
  }, [properties]);

  const byStatus = useMemo(
    () =>
      [
        { name: "منتشرشده", value: stats.published, color: "#3dd68c" },
        { name: "پیش‌نویس", value: stats.draft, color: "#f5c542" },
        { name: "بایگانی", value: stats.archived, color: "#9aa3b2" },
      ].filter((x) => x.value > 0),
    [stats],
  );

  const byPropertyType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties) {
      counts.set(p.propertyType, (counts.get(p.propertyType) ?? 0) + 1);
    }
    return PROPERTY_TYPES.map((t) => ({
      name: t.title,
      value: counts.get(t.id) ?? 0,
    })).filter((x) => x.value > 0);
  }, [properties]);

  const sellStats = useMemo(() => {
    const sell = properties.filter((p) => p.transactionType === "sell");
    const sellPublished = sell.filter((p) => p.status === "published").length;
    const sellArchived = sell.filter((p) => p.status === "archived").length;
    let totalPrice = 0;
    let priced = 0;
    for (const p of sell) {
      if (p.price) {
        const n = Number(p.price);
        if (Number.isFinite(n) && n > 0) {
          totalPrice += n;
          priced += 1;
        }
      }
    }
    return {
      total: sell.length,
      published: sellPublished,
      archived: sellArchived,
      avgPrice: priced ? Math.round(totalPrice / priced) : 0,
    };
  }, [properties]);

  const tipStyle = {
    background: "#10141a",
    border: "1px solid rgba(201,162,74,.35)",
    borderRadius: 12,
    direction: "rtl" as const,
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CHART_CSS }} />

      <div className="admin-sell-stats">
        <div className="admin-sell-stat">
          <span>فایل‌های فروش</span>
          <strong>{sellStats.total.toLocaleString("fa-IR")}</strong>
        </div>
        <div className="admin-sell-stat" data-tone="green">
          <span>فروش فعال (منتشر)</span>
          <strong>{sellStats.published.toLocaleString("fa-IR")}</strong>
        </div>
        <div className="admin-sell-stat" data-tone="muted">
          <span>بایگانی‌شده</span>
          <strong>{sellStats.archived.toLocaleString("fa-IR")}</strong>
        </div>
        <div className="admin-sell-stat" data-tone="amber">
          <span>میانگین قیمت فروش</span>
          <strong>{sellStats.avgPrice ? formatToman(sellStats.avgPrice) : "—"}</strong>
        </div>
      </div>

      <div className="admin-charts-grid">
        <div className="admin-chart-card">
          <h3>فعالیت ماهانه فایل‌ها</h3>
          <p className="chart-sub">ثبت · انتشار · بایگانی در ۶ ماه اخیر</p>
          {properties.length === 0 ? (
            <div className="admin-chart-empty">هنوز فایلی ثبت نشده</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a24a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c9a24a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPublished" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3dd68c" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3dd68c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(244,239,230,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#7d766c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#7d766c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={tipStyle}
                  labelStyle={{ color: "#e0c47a" }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("fa-IR"),
                    name === "created"
                      ? "ثبت‌شده"
                      : name === "published"
                        ? "منتشرشده"
                        : "بایگانی",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="created"
                  stroke="#c9a24a"
                  fill="url(#gCreated)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="published"
                  name="published"
                  stroke="#3dd68c"
                  fill="url(#gPublished)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="archived"
                  name="archived"
                  stroke="#9aa3b2"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="admin-chart-card">
          <h3>نوع معامله</h3>
          <p className="chart-sub">توزیع فایل‌ها بر اساس فروش / رهن / اجاره</p>
          {byTransaction.length === 0 ? (
            <div className="admin-chart-empty">داده‌ای نیست</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={byTransaction}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {byTransaction.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tipStyle}
                  formatter={(value: number) => value.toLocaleString("fa-IR")}
                />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value) => (
                    <span style={{ color: "#b7b0a4", fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="admin-charts-row">
        <div className="admin-chart-card">
          <h3>وضعیت انتشار</h3>
          <p className="chart-sub">منتشر · پیش‌نویس · بایگانی</p>
          {byStatus.length === 0 ? (
            <div className="admin-chart-empty">داده‌ای نیست</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(244,239,230,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#7d766c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#7d766c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={tipStyle}
                  formatter={(value: number) => value.toLocaleString("fa-IR")}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {byStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="admin-chart-card">
          <h3>نوع ملک</h3>
          <p className="chart-sub">آپارتمان، ویلا، اداری و ...</p>
          {byPropertyType.length === 0 ? (
            <div className="admin-chart-empty">داده‌ای نیست</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={byPropertyType}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(244,239,230,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#7d766c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fill: "#b7b0a4", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tipStyle}
                  formatter={(value: number) => value.toLocaleString("fa-IR")}
                />
                <Bar dataKey="value" fill="#c9a24a" radius={[0, 8, 8, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
