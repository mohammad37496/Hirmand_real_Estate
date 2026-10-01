import { CalendarDays, Phone, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "@/admin-viewing-calendar.css";

type Item = {
  id: string;
  name: string;
  phone: string;
  preferredAt: string;
  status: string;
  consultant: string;
  propertyTitle: string;
  propertySlug: string;
  neighborhood: string;
};

const STATUS_LABEL: Record<string, string> = {
  requested: "درخواست بازدید",
  confirmed: "تأیید شده",
};

function dayKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return year + "-" + month + "-" + day;
}

function dayLabel(key: string) {
  const date = new Date(key + "T12:00:00+03:30");
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long" }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AdminViewingCalendar() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-viewing-calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = dayKey(item.preferredAt);
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <section className="admin-viewing-calendar admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="kicker">تقویم بازدید</span>
          <h2>بازدیدهای پیش‌رو</h2>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "admin-spin" : undefined} /> به‌روزرسانی
        </button>
      </div>

      {loading && !items.length ? (
        <div className="admin-viewing-empty">در حال بارگذاری تقویم…</div>
      ) : groups.length ? (
        <div className="admin-viewing-days">
          {groups.map(([key, dayItems]) => (
            <section key={key} className="admin-viewing-day">
              <header>
                <CalendarDays size={16} />
                <strong>{dayLabel(key)}</strong>
                <span>{dayItems.length.toLocaleString("fa-IR")} بازدید</span>
              </header>
              <div className="admin-viewing-list">
                {dayItems.map((item) => (
                  <article key={item.id} className="admin-viewing-card">
                    <div className="admin-viewing-time">{timeLabel(item.preferredAt)}</div>
                    <div className="admin-viewing-main">
                      <strong>{item.name}</strong>
                      <a href={"tel:" + item.phone}><Phone size={13} />{item.phone}</a>
                      <span>{item.propertyTitle}{item.neighborhood ? " · " + item.neighborhood : ""}</span>
                      {item.consultant ? <small>مشاور: {item.consultant}</small> : null}
                    </div>
                    <span className={"admin-viewing-status is-" + item.status}>{STATUS_LABEL[item.status] ?? item.status}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="admin-viewing-empty">
          <CalendarDays size={26} />
          <strong>بازدید برنامه‌ریزی‌شده‌ای وجود ندارد.</strong>
          <span>درخواست‌های جدید بعد از ثبت مشتری اینجا ظاهر می‌شوند.</span>
        </div>
      )}
    </section>
  );
}
