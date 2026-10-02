import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, ExternalLink, RefreshCw, TrendingDown } from "lucide-react";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { listPublishedPropertyCards, type PropertyCardData } from "@/lib/properties";
import { absoluteUrl, socialMeta } from "@/lib/seo";

type WatchAlert = { id: string; slug: string; type: string; message: string; createdAt: string };
type FeedItem = { id: string; kind: "watch" | "drop" | "new"; title: string; text: string; href?: string; createdAt?: string; alertId?: string };

const SEEN_AT_KEY = "hirmand-notification-seen-at";
const SEEN_ALERTS_KEY = "hirmand-notification-alerts-seen";

export const Route = createFileRoute("/notifications")({
  head: () => {
    const title = "مرکز اعلان‌ها | املاک هیرمند";
    const description = "تغییر قیمت، تغییر وضعیت و فایل‌های تازه هیرمند را یک‌جا ببینید.";
    return { meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex, follow" }, ...socialMeta({ title, description, url: absoluteUrl("/notifications") })], links: [{ rel: "canonical", href: absoluteUrl("/notifications") }] };
  },
  component: NotificationsPage,
});

function safeRead(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function safeWrite(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} }

function NotificationsPage() {
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [recent, setRecent] = useState<PropertyCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  async function refresh() {
    setLoading(true);
    try {
      const [watchResponse, latest] = await Promise.all([
        fetch("/api/property-watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync" }) })
          .then((response) => response.json() as Promise<{ alerts?: WatchAlert[] }>),
        listPublishedPropertyCards({ data: { sort: "newest", offset: 0 } }),
      ]);
      const nextAlerts = Array.isArray(watchResponse.alerts) ? watchResponse.alerts : [];
      setAlerts(nextAlerts);
      setRecent(latest);
      if ("Notification" in window) setBrowserPermission(Notification.permission);

      const seen = new Set<string>(JSON.parse(safeRead(SEEN_ALERTS_KEY) ?? "[]"));
      const freshAlerts = nextAlerts.filter((alert) => !seen.has(alert.id));
      if (Notification.permission === "granted" && freshAlerts.length) {
        for (const alert of freshAlerts.slice(0, 2)) {
          new Notification("هیرمند · اعلان ملک", { body: alert.message });
          seen.add(alert.id);
        }
        safeWrite(SEEN_ALERTS_KEY, JSON.stringify([...seen].slice(-100)));
      }
      safeWrite(SEEN_AT_KEY, new Date().toISOString());
    } catch {
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = alerts.map((alert) => ({
      id: "watch:" + alert.id,
      kind: "watch",
      title: alert.type === "price_drop" ? "کاهش قیمت فایل پیگیری‌شده" : "تغییر در فایل پیگیری‌شده",
      text: alert.message,
      href: "/properties/" + encodeURIComponent(alert.slug),
      createdAt: alert.createdAt,
      alertId: alert.id,
    }));
    const seenAt = Date.parse(safeRead(SEEN_AT_KEY) ?? "");
    const windowStart = Number.isFinite(seenAt) ? seenAt : Date.now() - 48 * 60 * 60 * 1000;
    for (const property of recent) {
      const publishedAt = property.publishedAt ? Date.parse(property.publishedAt) : NaN;
      if (Number.isFinite(publishedAt) && publishedAt >= windowStart) {
        items.push({ id: "new:" + property.id, kind: "new", title: "فایل جدید", text: property.title + " · " + property.neighborhood, href: "/properties/" + encodeURIComponent(property.slug), createdAt: property.publishedAt ?? undefined });
      }
      if ((property.priceDropPercent ?? 0) > 0) {
        items.push({ id: "drop:" + property.id, kind: "drop", title: "کاهش قیمت " + property.priceDropPercent + "%", text: property.title + " · " + property.neighborhood, href: "/properties/" + encodeURIComponent(property.slug), createdAt: property.updatedAt ?? property.publishedAt ?? undefined });
      }
    }
    return items.sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "")).slice(0, 30);
  }, [alerts, recent]);

  async function requestBrowserNotifications() {
    if (!("Notification" in window)) { setBrowserPermission("unsupported"); return; }
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === "granted") void refresh();
  }

  async function markAllSeen() {
    const ids = alerts.map((alert) => Number(alert.id)).filter(Number.isFinite);
    if (ids.length) {
      await fetch("/api/property-watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "seen", alertIds: ids }) }).catch(() => {});
    }
    const alertSeen = new Set<string>(JSON.parse(safeRead(SEEN_ALERTS_KEY) ?? "[]"));
    alerts.forEach((alert) => alertSeen.add(alert.id));
    safeWrite(SEEN_ALERTS_KEY, JSON.stringify([...alertSeen].slice(-100)));
    safeWrite(SEEN_AT_KEY, new Date().toISOString());
    setAlerts([]);
    setRecent([]);
  }

  return (
    <SiteChrome className="property-detail-shell">
      <main className="smart-tool-page">
        <section className="smart-tool-hero notification-hero">
          <span className="kicker">یک‌جا، بدون گم‌شدن اعلان</span>
          <h1>مرکز اعلان‌های هیرمند</h1>
          <p>کاهش قیمت، تغییر وضعیت فایل‌های پیگیری‌شده و فایل‌های تازه در یک صفحه جمع می‌شوند.</p>
          <div className="notification-actions">
            <button type="button" className="btn-gold" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> {loading ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}</button>
            {browserPermission !== "granted" && browserPermission !== "denied" && browserPermission !== "unsupported" ? <button type="button" className="btn-ghost" onClick={() => void requestBrowserNotifications()}><BellRing size={16} /> فعال‌سازی اعلان مرورگر</button> : null}
            <button type="button" className="btn-ghost" onClick={() => void markAllSeen()}><CheckCheck size={16} /> پاک‌کردن موارد دیده‌نشده</button>
          </div>
          {browserPermission === "denied" ? <small className="notification-note">اعلان مرورگر در تنظیمات مرورگر مسدود شده است.</small> : null}
        </section>
        <section className="notification-feed" aria-live="polite">
          <div className="smart-search-result-head">
            <div><span className="kicker">آخرین رویدادها</span><h2>{feed.length.toLocaleString("fa-IR")} اعلان فعال</h2></div>
            <Link to="/properties" className="btn-ghost">مشاهده فایل‌ها <ExternalLink size={15} /></Link>
          </div>
          {feed.length ? <div className="notification-list">
            {feed.map((item) => (
              <article key={item.id} className="notification-card">
                <div className="notification-icon" aria-hidden="true">{item.kind === "watch" || item.kind === "drop" ? <TrendingDown size={18} /> : <Bell size={18} />}</div>
                <div className="notification-copy"><strong>{item.title}</strong><p>{item.text}</p>{item.createdAt ? <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("fa-IR")}</time> : null}</div>
                {item.href ? <Link to={item.href} className="notification-open">باز کردن</Link> : null}
              </article>
            ))}
          </div> : <section className="property-empty"><Bell size={28} /><strong>فعلاً اعلان فعالی ندارید.</strong><p>روی جزئیات فایل‌ها «پیگیری کاهش قیمت» را فعال کنید تا تغییرات مهم را از همین‌جا ببینید.</p><Link to="/properties" className="btn-gold">رفتن به فایل‌ها</Link></section>}
        </section>
      </main>
    </SiteChrome>
  );
}
