import { CalendarClock, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Availability = "available" | "reserved" | "sold" | "rented" | "unavailable";
type Item = {
  id: string;
  slug: string;
  title: string;
  neighborhood: string;
  transactionType: string;
  availabilityStatus: Availability;
  contactName: string;
  updatedAt: string | null;
};

const labels: Record<Availability, string> = {
  available: "موجود",
  reserved: "رزرو موقت",
  sold: "فروخته‌شده",
  rented: "اجاره‌داده‌شده",
  unavailable: "فعلاً ناموجود",
};

const tones: Record<Availability, string> = {
  available: "success",
  reserved: "warning",
  sold: "muted",
  rented: "muted",
  unavailable: "danger",
};

export function AdminPropertyAvailabilityCenter() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | Availability>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-property-availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!response.ok) throw new Error("بارگذاری وضعیت فایل‌ها انجام نشد.");
      const data = (await response.json()) as { items?: Item[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری وضعیت فایل‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.availabilityStatus !== filter) return false;
      if (!needle) return true;
      return [item.title, item.neighborhood, item.contactName, item.slug].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      );
    });
  }, [items, filter, query]);

  async function update(id: string, status: Availability) {
    if (busy) return;
    setBusy(id);
    try {
      const response = await fetch("/api/admin-property-availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", id, availabilityStatus: status }),
      });
      if (!response.ok) throw new Error("تغییر وضعیت فایل انجام نشد.");
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, availabilityStatus: status } : item));
      toast.success("وضعیت فایل ذخیره شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره وضعیت انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => ({
    reserved: items.filter((item) => item.availabilityStatus === "reserved").length,
    available: items.filter((item) => item.availabilityStatus === "available").length,
    closed: items.filter((item) => ["sold", "rented", "unavailable"].includes(item.availabilityStatus)).length,
  }), [items]);

  return (
    <section className="admin-panel admin-availability-center">
      <div className="admin-panel-head">
        <div>
          <span className="kicker">گردش فایل</span>
          <h2>رزرو و وضعیت واقعی فایل‌ها</h2>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "admin-spin" : ""} /> تازه‌سازی
        </button>
      </div>

      <div className="admin-dashboard-mini-grid">
        <div><span>رزرو موقت</span><strong>{counts.reserved.toLocaleString("fa-IR")}</strong></div>
        <div><span>موجود</span><strong>{counts.available.toLocaleString("fa-IR")}</strong></div>
        <div><span>خارج از دسترس</span><strong>{counts.closed.toLocaleString("fa-IR")}</strong></div>
      </div>

      <div className="admin-availability-toolbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی عنوان، محله یا مشاور…" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">همه وضعیت‌ها</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="admin-availability-list">
        {loading ? <div className="admin-empty"><CalendarClock size={24} /><strong>در حال بارگذاری وضعیت فایل‌ها…</strong></div> : null}
        {!loading && !visible.length ? <div className="admin-empty"><ShieldAlert size={24} /><strong>فایلی با این فیلتر پیدا نشد.</strong></div> : null}
        {visible.map((item) => (
          <article key={item.id} className="admin-availability-row">
            <div className="admin-availability-main">
              <div className="admin-availability-title">
                <strong>{item.title}</strong>
                <span data-tone={tones[item.availabilityStatus]}>{labels[item.availabilityStatus]}</span>
              </div>
              <p>{item.neighborhood || "بدون محله"} · مشاور: {item.contactName || "—"}</p>
            </div>
            <div className="admin-availability-actions">
              <select
                value={item.availabilityStatus}
                onChange={(e) => void update(item.id, e.target.value as Availability)}
                disabled={busy === item.id}
                aria-label={"وضعیت " + item.title}
              >
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <a className="btn-ghost" href={"/properties/" + item.slug} target="_blank" rel="noreferrer" aria-label={"مشاهده " + item.title}>
                <ExternalLink size={14} /> مشاهده
              </a>
              {busy === item.id ? <CheckCircle2 size={16} className="admin-spin" /> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
