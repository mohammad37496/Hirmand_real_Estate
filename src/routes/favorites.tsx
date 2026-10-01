import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Folder, Heart, Loader2, Save, Search, Star, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { customerFetch } from "@/lib/customer-fetch";
import "@/favorites-organization.css";

const FAVORITES_KEY = "hirmand-favorite-properties";
const RECENT_PROPERTIES_KEY = "hirmand-recent-properties";
const DEFAULT_CATEGORIES = ["عمومی", "بررسی", "تماس", "مهم"];

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
  const [favoriteMeta, setFavoriteMeta] = useState<Record<string, { category: string; privateNote: string; priority: number }>>({});
  const [activeCategory, setActiveCategory] = useState("همه");

  useEffect(() => {
    let cancelled = false;
    const localFavoriteSlugs = readFavorites();
    void customerFetch("/api/customer-favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "sync", slugs: localFavoriteSlugs }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json().catch(() => null) as { enabled?: boolean; slugs?: string[]; metadata?: Array<{slug:string;category:string;privateNote:string;priority:number}> } | null;
        if (!data?.enabled || !Array.isArray(data.slugs) || cancelled) return;
        if (Array.isArray(data.metadata)) {
          setFavoriteMeta(Object.fromEntries(data.metadata.map((item) => [
            item.slug,
            { category: item.category || "عمومی", privateNote: item.privateNote || "", priority: Number(item.priority || 0) },
          ])));
        }
        const remote = cleanSlugs(data.slugs, 100);
        const merged = cleanSlugs([...localFavoriteSlugs, ...remote], 100);
        persistSlugs(FAVORITES_KEY, merged);
        if (merged.length) {
          void listPublishedPropertiesBySlugs({ data: { slugs: merged } })
            .then((rows) => {
              if (cancelled) return;
              setProperties(rows);
              setLoading(false);
            })
            .catch(() => undefined);
        } else if (!cancelled) {
          setProperties([]);
          setLoading(false);
        }
      })
      .catch(() => undefined);

    const favoriteSlugs = localFavoriteSlugs;
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
          <>
            <div className="favorites-organization-bar">
              <div className="favorites-category-tabs">
                {["همه", ...DEFAULT_CATEGORIES].map((category) => (
                  <button key={category} type="button" className={activeCategory === category ? "is-active" : ""} onClick={() => setActiveCategory(category)}>
                    <Folder size={14} /> {category}
                  </button>
                ))}
              </div>
              <span>{properties.filter((property) => activeCategory === "همه" || (favoriteMeta[property.slug]?.category || "عمومی") === activeCategory).length.toLocaleString("fa-IR")} فایل</span>
            </div>
            <div className="property-grid">
              {properties
                .filter((property) => activeCategory === "همه" || (favoriteMeta[property.slug]?.category || "عمومی") === activeCategory)
                .sort((a,b) => (favoriteMeta[b.slug]?.priority || 0) - (favoriteMeta[a.slug]?.priority || 0))
                .map((property) => (
                  <FavoriteOrganizedCard
                    key={property.id}
                    property={property}
                    meta={favoriteMeta[property.slug] || { category: "عمومی", privateNote: "", priority: 0 }}
                    onSaved={(meta) => setFavoriteMeta((current) => ({ ...current, [property.slug]: meta }))}
                  />
                ))}
            </div>
          </>
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


function FavoriteOrganizedCard({
  property, meta, onSaved,
}: {
  property: Property;
  meta: { category: string; privateNote: string; priority: number };
  onSaved: (meta: { category: string; privateNote: string; priority: number }) => void;
}) {
  const [category,setCategory]=useState(meta.category);
  const [note,setNote]=useState(meta.privateNote);
  const [priority,setPriority]=useState(meta.priority);
  const [saving,setSaving]=useState(false);
  async function save(){
    setSaving(true);
    try{
      const response=await customerFetch("/api/customer-favorites",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"update_meta",slug:property.slug,category,privateNote:note,priority})});
      if(!response.ok) throw new Error();
      onSaved({category,privateNote:note,priority});
    }catch{ /* Keep the local editor responsive if offline. */ }
    finally{setSaving(false);}
  }
  return (
    <article className="favorite-organized-card">
      <PropertyCard property={property}/>
      <div className="favorite-meta-editor">
        <div className="favorite-meta-row">
          <label><Folder size={14}/> دسته
            <select value={category} onChange={(e)=>setCategory(e.target.value)}>
              {DEFAULT_CATEGORIES.map((item)=><option key={item}>{item}</option>)}
            </select>
          </label>
          <label><Star size={14}/> اولویت
            <select value={priority} onChange={(e)=>setPriority(Number(e.target.value))}>
              <option value={0}>عادی</option><option value={1}>متوسط</option><option value={2}>بالا</option><option value={3}>خیلی مهم</option>
            </select>
          </label>
        </div>
        <label className="favorite-note-field"><span><StickyNote size={14}/> یادداشت خصوصی</span>
          <textarea value={note} onChange={(e)=>setNote(e.target.value)} maxLength={1000} placeholder="مثلاً فردا با مالک تماس بگیرم…"/>
        </label>
        <button type="button" className="btn-gold favorite-save-meta" disabled={saving} onClick={()=>void save()}><Save size={14}/>{saving?"در حال ذخیره…":"ذخیره اطلاعات"}</button>
      </div>
    </article>
  );
}
