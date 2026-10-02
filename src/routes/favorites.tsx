import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, CalendarDays, CheckCircle2, Clock3, Heart, Link2, Loader2, Search, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/hirmand/property-showcase";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { toast } from "sonner";

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


function readSharedFavorites(): string[] {
  try {
    const value = new URLSearchParams(window.location.search).get("share");
    return value
      ? cleanSlugs(value.split(",").map((item) => decodeURIComponent(item)), 12)
      : [];
  } catch {
    return [];
  }
}

async function shareFavorites(slugs: string[]) {
  const safe = cleanSlugs(slugs, 12);
  if (!safe.length) return;
  const url = new URL("/favorites", window.location.origin);
  url.searchParams.set("share", safe.join(","));
  const shareUrl = url.toString();
  try {
    if (navigator.share) {
      await navigator.share({
        title: "فایل‌های منتخب هیرمند",
        text: "سبد فایل‌های منتخب من در املاک هیرمند",
        url: shareUrl,
      });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("لینک سبد منتخب کپی شد.");
      return;
    }
    window.prompt("لینک سبد منتخب:", shareUrl);
  } catch {
    // Sharing can be cancelled by the visitor.
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
  const [sharedFavorites, setSharedFavorites] = useState<string[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planSlugs, setPlanSlugs] = useState<string[]>([]);
  const [planName, setPlanName] = useState("");
  const [planPhone, setPlanPhone] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [planTime, setPlanTime] = useState("17:00");
  const [planNote, setPlanNote] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [planCodes, setPlanCodes] = useState<string[]>([]);
  const [planError, setPlanError] = useState("");

  function openViewingPlan() {
    const first = properties.slice(0, 4).map((property) => property.slug);
    setPlanSlugs(first);
    setPlanCodes([]);
    setPlanError("");
    setPlanOpen(true);
  }

  function togglePlanProperty(slug: string) {
    setPlanSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length >= 4
          ? current
          : [...current, slug],
    );
  }

  function normalizePlanPhone(value: string) {
    return value
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/\D/g, "")
      .replace(/^(\+98|0098|98)/, "0");
  }

  async function submitViewingPlan(event: FormEvent) {
    event.preventDefault();
    setPlanError("");
    const phone = normalizePlanPhone(planPhone);
    if (planSlugs.length === 0) {
      setPlanError("حداقل یک فایل را انتخاب کنید.");
      return;
    }
    if (planName.trim().length < 2) {
      setPlanError("نام و نام خانوادگی را وارد کنید.");
      return;
    }
    if (!/^09\d{9}$/.test(phone)) {
      setPlanError("شماره موبایل معتبر وارد کنید.");
      return;
    }
    if (!planDate || !planTime) {
      setPlanError("روز و ساعت بازدید را مشخص کنید.");
      return;
    }
    const start = new Date(`${planDate}T${planTime}:00+03:30`);
    if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 30 * 60 * 1000) {
      setPlanError("زمان انتخابی باید حداقل ۳۰ دقیقه از اکنون فاصله داشته باشد.");
      return;
    }

    const selected = planSlugs
      .map((slug) => properties.find((property) => property.slug === slug))
      .filter((property): property is Property => Boolean(property));
    if (!selected.length) {
      setPlanError("فایل‌های انتخابی دیگر در دسترس نیستند.");
      return;
    }

    setPlanBusy(true);
    try {
      const preferredAt = start.toISOString();
      const groupText = selected.map((property) => property.title).join("، ");
      const results = await Promise.allSettled(
        selected.map(async (property) => {
          const response = await fetch("/api/leads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              name: planName.trim(),
              phone,
              peopleCount: 1,
              job: "",
              deal: "بازدید گروهی",
              propertyType: "بازدید فایل",
              neighborhood: property.neighborhood,
              floorPreference: "",
              requestedBedrooms: undefined,
              requestedAmenities: [],
              consultant: "",
              note: [
                "برنامه بازدید چندملکی",
                `فایل انتخابی: ${property.title}`,
                `ساعت پیشنهادی: ${preferredAt}`,
                `سایر فایل‌های همین برنامه: ${groupText}`,
                planNote.trim() ? `یادداشت مشتری: ${planNote.trim()}` : "",
              ].filter(Boolean).join("\n"),
              source: "website",
              propertyId: property.id,
              visitPreferredAt: preferredAt,
              matches: [],
            }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.statusMessage || payload?.message || "ثبت درخواست بازدید انجام نشد.");
          }
          return String(payload.trackingToken || "");
        }),
      );

      const codes = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled" && Boolean(result.value))
        .map((result) => result.value);
      const failures = results.filter((result) => result.status === "rejected").length;
      if (!codes.length) {
        throw new Error("هیچ‌یک از درخواست‌های بازدید ثبت نشد.");
      }
      setPlanCodes(codes);
      if (failures) {
        setPlanError(`${codes.length.toLocaleString("fa-IR")} درخواست ثبت شد و ${failures.toLocaleString("fa-IR")} مورد نیاز به بررسی دارد.`);
      } else {
        toast.success("برنامه بازدید شما برای فایل‌های انتخابی ثبت شد.");
      }
    } catch (cause) {
      setPlanError(cause instanceof Error ? cause.message : "ثبت برنامه بازدید انجام نشد.");
    } finally {
      setPlanBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const localFavoriteSlugs = readFavorites();
    const shared = readSharedFavorites();
    const favoriteSlugs = cleanSlugs([...localFavoriteSlugs, ...shared], 100);
    if (shared.length) {
      setSharedFavorites(shared);
      persistSlugs(FAVORITES_KEY, favoriteSlugs);
    }
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
            {properties.length ? (
              <>
                <button type="button" className="btn-gold" onClick={openViewingPlan}>
                  <CalendarDays size={15} /> برنامه بازدید
                </button>
                <button type="button" className="btn-gold" onClick={() => void shareFavorites(properties.map((property) => property.slug))}>
                  <Share2 size={15} /> اشتراک سبد
                </button>
              </>
            ) : null}
            <Link to="/compare" className="btn-ghost">
              <ArrowLeftRight size={15} /> مقایسه فایل‌ها
            </Link>
            <Heart size={30} />
          </div>
        </header>

        {planOpen ? (
          <div className="favorites-plan-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !planBusy) setPlanOpen(false);
          }}>
            <section className="favorites-plan-modal" role="dialog" aria-modal="true" aria-labelledby="favorites-plan-title">
              <button type="button" className="favorites-plan-close" onClick={() => !planBusy && setPlanOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
              {planCodes.length ? (
                <div className="favorites-plan-success">
                  <div className="favorites-plan-success-icon"><CheckCircle2 size={27} /></div>
                  <span className="kicker">برنامه ثبت شد</span>
                  <h2 id="favorites-plan-title">درخواست بازدید چندملکی دریافت شد.</h2>
                  <p>برای هماهنگی نهایی، مشاور هیرمند با شما تماس می‌گیرد.</p>
                  <div className="favorites-plan-codes">
                    <strong>کدهای رهگیری</strong>
                    {planCodes.map((code) => <span key={code} dir="ltr">{code}</span>)}
                  </div>
                  <div className="favorites-plan-success-actions">
                    <a className="btn-gold" href="/request-tracking">پیگیری درخواست‌ها</a>
                    <button type="button" className="btn-ghost" onClick={() => setPlanOpen(false)}>بستن</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitViewingPlan}>
                  <div className="favorites-plan-head">
                    <span className="kicker">هماهنگی یک‌جا</span>
                    <h2 id="favorites-plan-title">چند فایل را برای یک برنامه بازدید انتخاب کنید.</h2>
                    <p>حداکثر ۴ فایل را انتخاب کنید؛ برای هر فایل یک درخواست بازدید ثبت می‌شود.</p>
                  </div>
                  <div className="favorites-plan-properties">
                    {properties.map((property) => {
                      const selected = planSlugs.includes(property.slug);
                      return (
                        <button key={property.id} type="button" className={"favorites-plan-property" + (selected ? " is-selected" : "")} onClick={() => togglePlanProperty(property.slug)}>
                          <span>
                            <strong>{property.title}</strong>
                            <small>{property.neighborhood}</small>
                          </span>
                          <span>{selected ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="favorites-plan-grid">
                    <label className="field"><span>نام و نام خانوادگی</span><input value={planName} onChange={(event) => setPlanName(event.target.value)} autoComplete="name" /></label>
                    <label className="field"><span>شماره موبایل</span><input value={planPhone} onChange={(event) => setPlanPhone(event.target.value)} inputMode="tel" dir="ltr" autoComplete="tel" /></label>
                    <label className="field"><span>روز پیشنهادی</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={planDate} onChange={(event) => setPlanDate(event.target.value)} dir="ltr" /></label>
                    <label className="field"><span>ساعت پیشنهادی</span><select value={planTime} onChange={(event) => setPlanTime(event.target.value)} dir="ltr">{["09:00","10:00","11:00","12:00","15:00","16:00","17:00","18:00","19:00","20:00"].map((time) => <option key={time}>{time}</option>)}</select></label>
                    <label className="field favorites-plan-note"><span>یادداشت (اختیاری)</span><textarea rows={3} value={planNote} onChange={(event) => setPlanNote(event.target.value)} placeholder="مثلاً دو نفر هستیم یا ترجیح می‌دهیم فایل‌ها پشت سر هم دیده شوند..." /></label>
                  </div>
                  {planError ? <p className="favorites-plan-error" role="alert">{planError}</p> : null}
                  <div className="favorites-plan-actions">
                    <button type="button" className="btn-ghost" onClick={() => setPlanOpen(false)} disabled={planBusy}>انصراف</button>
                    <button type="submit" className="btn-gold" disabled={planBusy || !planSlugs.length}>
                      <CalendarDays size={17} />
                      {planBusy ? "در حال ثبت..." : `ثبت ${planSlugs.length.toLocaleString("fa-IR")} درخواست بازدید`}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        ) : null}

        {sharedFavorites.length ? (
          <section className="favorites-share-banner" aria-label="سبد اشتراکی">
            <div>
              <span className="kicker">سبد اشتراکی</span>
              <strong>{sharedFavorites.length.toLocaleString("fa-IR")} فایل از یک لینک دریافت شد.</strong>
              <p>این فایل‌ها به ذخیره‌های این مرورگر اضافه شدند تا بعداً هم در دسترس باشند.</p>
            </div>
            <Link to="/properties" className="btn-ghost">
              <Link2 size={15} /> مشاهده همه فایل‌ها
            </Link>
          </section>
        ) : null}

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
