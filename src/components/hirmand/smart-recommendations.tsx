import { useEffect, useState } from "react";
import { Clock3, Sparkles } from "lucide-react";
import { listPublishedPropertyCardsBySlugs, type PropertyCardData } from "@/lib/properties";
import { PropertyCard } from "./property-showcase";

const RECENT_PROPERTIES_KEY = "hirmand-recent-properties";

export function SmartRecommendations() {
  const [properties, setProperties] = useState<PropertyCardData[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_PROPERTIES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const slugs = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string").slice(0, 6)
        : [];
      if (!slugs.length) return;
      void listPublishedPropertyCardsBySlugs({ data: { slugs } }).then(setProperties).catch(() => undefined);
    } catch {
      // Recommendations are optional convenience content.
    }
  }, []);

  if (!properties.length) return null;

  return (
    <section className="section smart-recommendations" aria-labelledby="smart-recommendations-title">
      <div className="section-head">
        <span className="kicker"><Sparkles size={14} /> پیشنهاد هوشمند</span>
        <h2 id="smart-recommendations-title">فایل‌هایی که اخیراً دیده‌اید</h2>
        <p>برای اینکه جست‌وجویتان را از صفر شروع نکنید، فایل‌های مشاهده‌شده اخیر را اینجا نگه می‌داریم.</p>
      </div>
      <div className="smart-recommendations-note">
        <Clock3 size={15} /> این فهرست فقط در همین مرورگر ذخیره می‌شود.
      </div>
      <div className="property-grid">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}
