import { Bell, BellRing, CheckCheck, ExternalLink, Search, Settings2, Tag, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import "@/customer-alert-center.css";

type AlertItem = {
  id: string;
  slug: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
};

type AlertResponse = {
  enabled: boolean;
  searches?: Array<{ clientId: string; name: string; params: string; enabled: boolean; updatedAt: string }>;
  alerts?: AlertItem[];
};

async function fetchAlerts(body: Record<string, unknown>) {
  const response = await fetch("/api/saved-searches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as AlertResponse | { statusMessage?: string } | null;
  if (!response.ok) throw new Error((data as { statusMessage?: string } | null)?.statusMessage || "اعلان‌ها در دسترس نیستند.");
  return data as AlertResponse;
}

export function CustomerAlertCenter() {
  const [enabled, setEnabled] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [open, setOpen] = useState(false);
  const seenInBrowser = useRef(new Set<string>());

  const load = useCallback(async (silent = true) => {
    try {
      const data = await fetchAlerts({ action: "list" });
      setEnabled(Boolean(data.enabled));
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setSearchCount(Array.isArray(data.searches) ? data.searches.length : 0);

      for (const alert of data.alerts ?? []) {
        if (seenInBrowser.current.has(alert.id)) continue;
        seenInBrowser.current.add(alert.id);
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator) {
          void navigator.serviceWorker.ready.then((registration) =>
            registration.showNotification("هیرمند", {
              body: alert.message,
              icon: "/__grok/icon-180.png",
              badge: "/__grok/icon-180.png",
              data: { url: "/properties/" + alert.slug },
            }),
          ).catch(() => {});
        } else if (!silent) {
          toast.info(alert.message);
        }
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "اعلان‌ها در دسترس نیستند.");
    }
  }, []);

  useEffect(() => {
    void load(true);
    const interval = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast.info("مرورگر شما اعلان دسکتاپ را پشتیبانی نمی‌کند؛ اعلان‌ها داخل سایت همچنان در دسترس‌اند.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("اعلان‌های هیرمند فعال شد.");
      await load(false);
    } else {
      toast.info("مجوز اعلان فعال نشد. اعلان‌ها داخل همین سایت نمایش داده می‌شوند.");
    }
  }

  async function markSeen(ids: string[]) {
    if (!ids.length) return;
    try {
      await fetchAlerts({ action: "seen", alertIds: ids.map((id) => Number(id)).filter(Number.isFinite) });
      setAlerts((current) => current.filter((item) => !ids.includes(item.id)));
    } catch {
      toast.error("علامت‌گذاری اعلان انجام نشد.");
    }
  }

  if (!enabled) return null;

  const unread = alerts.length;
  return (
    <div className="customer-alert-center">
      <button
        type="button"
        className="customer-alert-trigger"
        aria-label={unread ? `اعلان‌های هیرمند؛ ${unread} اعلان جدید` : "اعلان‌های هیرمند"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {unread ? <BellRing size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
        {unread ? <span className="customer-alert-count">{unread.toLocaleString("fa-IR")}</span> : null}
      </button>

      {open ? (
        <section className="customer-alert-panel" aria-label="مرکز اعلان‌های هیرمند">
          <header>
            <div>
              <span className="kicker">مرکز اعلان</span>
              <h2>پیگیری‌های شما</h2>
            </div>
            <button type="button" className="customer-alert-close" onClick={() => setOpen(false)} aria-label="بستن"><X size={17} /></button>
          </header>

          <div className="customer-alert-search-summary">
            <Search size={16} aria-hidden="true" />
            <span>{searchCount ? searchCount.toLocaleString("fa-IR") + " جست‌وجوی ذخیره‌شده و فعال" : "هنوز جست‌وجویی برای اعلان ذخیره نشده"}</span>
            <a href="/properties"><ExternalLink size={14} /> فایل‌ها</a>
          </div>

          {searchCount && typeof Notification !== "undefined" && Notification.permission !== "granted" ? (
            <button type="button" className="customer-alert-enable" onClick={() => void enableNotifications()}>
              <Settings2 size={15} /> فعال‌سازی اعلان مرورگر
            </button>
          ) : null}

          {alerts.length ? (
            <>
              <div className="customer-alert-list">
                {alerts.map((alert) => (
                  <a
                    key={alert.id}
                    href={"/properties/" + alert.slug}
                    className="customer-alert-item"
                    onClick={() => void markSeen([alert.id])}
                  >
                    <span className="customer-alert-icon">
                      {alert.type === "price_drop" ? <Tag size={16} /> : <Search size={16} />}
                    </span>
                    <span>
                      <strong>{alert.title}</strong>
                      <small>{alert.message}</small>
                    </span>
                  </a>
                ))}
              </div>
              <button type="button" className="customer-alert-seen-all" onClick={() => void markSeen(alerts.map((item) => item.id))}>
                <CheckCheck size={15} /> همه دیده شد
              </button>
            </>
          ) : (
            <div className="customer-alert-empty">
              <Bell size={28} />
              <strong>اعلان جدیدی ندارید</strong>
              <p>با تغییر قیمت یا انتشار فایل منطبق، اینجا اطلاع می‌گیرید.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
