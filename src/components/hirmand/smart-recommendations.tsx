import { Clock3, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { listPublishedPropertyCardsBySlugs, type PropertyCardData } from "@/lib/properties";
import { PropertyCard } from "./property-showcase";

const RECENT_PROPERTIES_KEY = "hirmand-recent-properties";

type RecommendationItem = PropertyCardData & { reason?: string };

type RecommendationResponse = {
  enabled?: boolean;
  reason?: string;
  items?: RecommendationItem[];
};

function readRecentSlugs() {
  try {
    const raw = localStorage.getItem(RECENT_PROPERTIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim()).slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export function SmartRecommendations() {
  const [properties, setProperties] = useState<RecommendationItem[]>([]);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/customer-recommendations", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as RecommendationResponse | null;
        if (!response.ok || !data?.enabled || cancelled) return null;
        if (data.items?.length) {
          setProperties(data.items);
          setPersonalized(data.reason === "personalized");
          return true;
        }
        return false;
      })
      .catch(() => false)
      .then((hasRecommendations) => {
        if (cancelled || hasRecommendations === true) return;
        const slugs = readRecentSlugs();
        if (!slugs.length) return;
        void listPublishedPropertyCardsBySlugs({ data: { slugs } })
          .then((rows) => {
            if (!cancelled) setProperties(rows);
          })
          .catch(() => undefined);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!properties.length) return null;

  return (
    <section className="section smart-recommendations" aria-labelledby="smart-recommendations-title">
      <div className="section-head">
        <span className="kicker"><Sparkles size={14} /> پیشنهاد هوشمند</span>
        <h2 id="smart-recommendations-title">
          {personalized ? "گزینه‌های نزدیک به سلیقه شما" : "فایل‌هایی که اخیراً دیده‌اید"}
        </h2>
        <p>
          {personalized
            ? "بر اساس فایل‌های ذخیره‌شده و جست‌وجوهای فعال شما، چند گزینه نزدیک را انتخاب کرده‌ایم."
            : "برای اینکه جست‌وجویتان را از صفر شروع نکنید، فایل‌های مشاهده‌شده اخیر را اینجا نگه می‌داریم."}
        </p>
      </div>
      {!personalized ? (
        <div className="smart-recommendations-note">
          <Clock3 size={15} /> این بخش فقط برای همین مرورگر نگه‌داری می‌شود.
        </div>
      ) : null}
      <div className="property-grid">
        {properties.map((property) => (
          <div className="smart-recommendation-card" key={property.id}>
            <PropertyCard property={property} />
            {"reason" in property && property.reason ? (
              <div className="smart-recommendation-reason"><Sparkles size={13} /> {property.reason}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
