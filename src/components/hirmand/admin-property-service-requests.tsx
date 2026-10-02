import { ClipboardCheck, ExternalLink, Filter, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Status = "new" | "contacted" | "follow_up" | "closed";
type Item = {
  id: string;
  name: string;
  phone: string;
  deal: string;
  neighborhood: string;
  propertyId: string | null;
  propertySlug: string | null;
  propertyTitle: string | null;
  status: Status;
  createdAt: string;
  followUpAt: string | null;
  note: string;
};

const REQUESTS = [
  "درخواست کارشناسی فنی",
  "درخواست محتوای جدید",
  "بررسی حقوقی معامله",
  "درخواست تأیید اطلاعات فایل",
];

const STATUS = {
  new: "جدید",
  contacted: "در حال بررسی",
  follow_up: "نیازمند پیگیری",
  closed: "انجام شد / بسته",
} as const;

function normalizePhone(value: string) {
  const digits = value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
  if (digits.startsWith("98")) return digits;
  if (digits.startsWith("0")) return "98" + digits.slice(1);
  if (digits.startsWith("9")) return "98" + digits;
  return digits;
}

export function AdminPropertyServiceRequests() {
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-property-service-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!response.ok) throw new Error("بارگذاری درخواست‌های خدمات انجام نشد.");
      const data = (await response.json()) as { items?: Item[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری درخواست‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter((item) =>
    (kind === "all" || item.deal === kind) && (status === "all" || item.status === status)
  ), [items, kind, status]);

  async function updateStatus(id: string, next: Status) {
    if (busy) return;
    setBusy(id);
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", id, status: next }),
      });
      if (!response.ok) throw new Error("تغییر وضعیت درخواست انجام نشد.");
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: next } : item));
      toast.success("وضعیت درخواست به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره وضعیت انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function openWhatsapp(item: Item) {
    const phone = normalizePhone(item.phone).replace(/^0+/, "").replace(/^98?/, "98");
    const text = encodeURIComponent(
      "سلام " + item.name + "، درخواست «" + item.deal + "» شما در هیرمند در حال پیگیری است.",
    );
    window.open("https://wa.me/" + phone + "?text=" + text, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="admin-panel admin-service-requests">
      <div className="admin-panel-head">
        <div>
          <span className="kicker">خدمات تخصصی</span>
          <h2>صف درخواست‌های بررسی و خدمات ملک</h2>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "admin-spin" : ""} /> تازه‌سازی
        </button>
      </div>
      <div className="admin-service-filters">
        <Filter size={15} />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">همه خدمات</option>
          {REQUESTS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">همه وضعیت‌ها</option>
          {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="admin-service-list">
        {loading ? <div className="admin-empty"><ClipboardCheck size={24} /><strong>در حال بارگذاری درخواست‌ها…</strong></div> : null}
        {!loading && !visible.length ? <div className="admin-empty"><ClipboardCheck size={24} /><strong>درخواستی پیدا نشد.</strong></div> : null}
        {visible.map((item) => (
          <article key={item.id} className="admin-service-row">
            <div className="admin-service-main">
              <div className="admin-service-title"><strong>{item.deal}</strong><span>{STATUS[item.status]}</span></div>
              <p>{item.name} · {item.phone} · {item.neighborhood || "بدون محله"}</p>
              {item.propertyTitle ? <small>فایل: {item.propertyTitle}</small> : null}
              {item.note ? <small>{item.note}</small> : null}
            </div>
            <div className="admin-service-actions">
              <select value={item.status} onChange={(e) => void updateStatus(item.id, e.target.value as Status)} disabled={busy === item.id}>
                {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <a className="btn-ghost" href={"tel:" + item.phone}><span>تماس</span></a>
              <button type="button" className="btn-ghost" onClick={() => void openWhatsapp(item)}>واتساپ</button>
              {item.propertySlug ? <a className="btn-ghost" href={"/properties/" + item.propertySlug} target="_blank" rel="noreferrer"><ExternalLink size={14} /> فایل</a> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
