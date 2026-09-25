import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Heart, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";

const FAVORITES_KEY = "hirmand-favorite-properties";
const RECENT_PROPERTIES_KEY = "hirmand-recent-properties";

function cleanSlugs(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0 && item.length <= 220,
    ).map((item) => item.trim()),
  )).slice(0, limit);
}

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return cleanSlugs(raw ? JSON.parse(raw) : [], 100);
  } catch {
    return [];
  }
}

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_PROPERTIES_KEY);
    return cleanSlugs(raw ? JSON.parse(raw) : [], 8);
  } catch {
    return [];
  }
}

function persistSlugs(key: string, slugs: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(slugs));
  } catch {
    // Storage can be unavailable in private browsing; the current page still works.
  }
}

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: `فایل‌های ذخیره‌شده | ${SITE.nameFa}` },
      { name: "description", content: "فایل‌های ملکی ذخیره‌شده شما در سایت هیرمند." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const favoriteSlugs = readFavorites();
    const recentSlugs = readRecent();

    if (favoriteSlugs.length) {
      void listPublishedPropertiesBySlugs({ data: { slugs: favoriteSlugs } })
        .then((rows) => {
          if (cancelled) return;
          setProperties(rows);
          const valid = new Set(rows.map((property) => property.slug));
          const retained = favoriteSlugs.filter((slug) => valid.has(slug));
          if (retained.length !== favoriteSlugs.length) persistSlugs(FAVORITES_KEY, retained);
        })
        .catch(() => {
          if (!cancelled) setProperties([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    if (recentSlugs.length) {
      void listPublishedPropertiesBySlugs({ data: { slugs: recentSlugs } })
        .then((rows) => {
          if (cancelled) return;
          setRecentProperties(rows);
          const valid = new Set(rows.map((property) => property.slug));
          const retained = recentSlugs.filter((slug) => valid.has(slug));
          if (retained.length !== recentSlugs.length) persistSlugs(RECENT_PROPERTIES_KEY, retained);
        })
        .catch(() => {
          if (!cancelled) setRecentProperties([]);
        })
        .finally(() => {
          if (!cancelled) setRecentLoading(false);
        });
    } else {
      setRecentLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteChrome className="property-detail-shell">
      <main className="favorites-page">
        <header className="favorites-head">
          <div>
            <span className="kicker">انتخاب‌های شما</span>
            <h1>فایل‌های ذخیره‌شده</h1>
            <p>
              فایل‌هایی که برای مقایسه و بررسی بعدی ذخیره کرده‌اید، اینجا در دسترس هستند.
            </p>
          </div>
          <div className="favorites-head-actions">
            <Link to="/compare" className="btn-ghost">
              <ArrowLeftRight size={15} /> مقایسه فایل‌ها
            </Link>
            <Heart size={30} />
          </div>
        </header>

        {loading ? (
          <section className="property-empty">
            <Loader2 size={26} className="admin-spin" />
            <strong>در حال بارگذاری فایل‌های ذخیره‌شده…</strong>
          </section>
        ) : properties.length ? (
          <div className="property-grid">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <section className="property-empty">
            <Heart size={26} />
            <strong>هنوز فایلی ذخیره نکرده‌اید</strong>
            <p>در فهرست فایل‌ها روی علامت قلب بزنید تا گزینه‌های موردنظرتان اینجا جمع شوند.</p>
            <Link to="/properties" className="btn-gold">
              <Search size={16} />
              مشاهده فایل‌ها
            </Link>
          </section>
        )}

        {recentLoading || recentProperties.length ? (
          <section className="favorites-recent-section">
            <header className="favorites-head favorites-recent-head">
              <div>
                <span className="kicker">تاریخچه مرور</span>
                <h2>اخیراً دیده‌شده</h2>
                <p>آخرین فایل‌هایی که در این مرورگر بررسی کرده‌اید.</p>
              </div>
            </header>
            {recentLoading ? (
              <section className="property-empty">
                <Loader2 size={22} className="admin-spin" />
                <strong>در حال آماده‌سازی تاریخچه…</strong>
              </section>
            ) : (
              <div className="property-grid">
                {recentProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </SiteChrome>
  );
}
