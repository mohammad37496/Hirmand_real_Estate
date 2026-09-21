import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  Images,
  Import,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { mediaSourceCandidates } from "@/lib/media";
import { propertyPath } from "@/lib/property-path";
import {
  getDivarStats,
  importDivarFile,
  listDivarFiles,
  syncDivarFiles,
  type DivarFile,
} from "@/lib/divar";

const DIVAR_CSS = `
/* The admin shell renders on a light surface, so this section uses a dark-on-cream palette. */
.divar-wrap{display:flex;flex-direction:column;gap:18px;color:#111315}
.divar-wrap .kicker{color:rgb(0 0 0 / .55)!important;letter-spacing:.02em}
.divar-hero{position:relative;display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:24px;border:1px solid rgba(183,123,72,.26);border-radius:20px;background:linear-gradient(135deg,rgba(183,123,72,.10),rgba(0,0,0,.02))}
.divar-hero h2{margin:4px 0 8px;font-size:26px;letter-spacing:-.01em;color:#111315}
.divar-hero p{margin:0;color:rgb(0 0 0 / .62);max-width:720px;line-height:1.9;font-size:.86rem}
.divar-hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.divar-hero-actions select{min-height:46px;padding:0 12px;border-radius:12px;border:1px solid rgb(0 0 0 / .14);background:#fff;color:#111315;font:inherit}
.divar-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.divar-stat{display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:16px;border:1px solid rgb(0 0 0 / .1);background:#fff}
.divar-stat-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px;background:rgb(0 0 0 / .05)}
.divar-stat small{display:block;color:rgb(0 0 0 / .58);margin-bottom:6px;font-size:.74rem}
.divar-stat strong{font-size:24px;line-height:1.2;font-weight:800;color:#111315}
.divar-stat.accepted .divar-stat-icon{color:#7a5220;background:rgba(183,123,72,.16)}
.divar-stat.imported .divar-stat-icon{color:#17603f;background:rgba(24,122,88,.14)}
.divar-stat.rejected .divar-stat-icon{color:#8f3232;background:rgba(190,70,70,.13)}
.divar-stat.synced .divar-stat-icon{color:#2f3d63;background:rgba(60,80,140,.12)}
.divar-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid rgb(0 0 0 / .08)}
.divar-tabs{display:flex;gap:6px;flex-wrap:wrap}
.divar-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid rgb(0 0 0 / .12);background:#fff;color:#111315;border-radius:12px;padding:10px 14px;cursor:pointer;font:inherit;font-size:.82rem;transition:border-color .15s,background .15s,color .15s}
.divar-tab:hover{border-color:rgba(183,123,72,.5)}
.divar-tab.is-active{background:#111315;border-color:#111315;color:#f7f5ef}
.divar-tab b{font-weight:800}
.divar-smart-toolbar{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid rgb(0 0 0 / .08)}
.divar-search-box{display:flex;align-items:center;gap:9px;flex:1 1 280px;min-width:0;min-height:46px;padding:0 14px;border:1px solid rgb(0 0 0 / .14);border-radius:14px;background:#fff;color:rgb(0 0 0 / .55)}
.divar-search-box:focus-within{border-color:#111315}
.divar-search-box input{flex:1;min-width:0;border:0;background:transparent;color:#111315;font:inherit;outline:none}
.divar-filter-group{display:flex;gap:10px;flex-wrap:wrap}
.divar-select-field{display:flex;flex-direction:column;gap:5px}
.divar-select-field>span{color:rgb(0 0 0 / .52);font-size:.68rem}
.divar-select-field select{min-height:44px;padding:0 10px;border-radius:12px;border:1px solid rgb(0 0 0 / .14);background:#fff;color:#111315;font:inherit;font-size:.82rem}
.divar-toggle{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid rgb(0 0 0 / .14);border-radius:12px;background:#fff;color:#111315;font-size:.82rem;cursor:pointer}
.divar-toggle input{accent-color:#111315}
.divar-toolbar-result{display:flex;align-items:center;gap:7px;color:rgb(0 0 0 / .6);font-size:.8rem}
.divar-toolbar-result strong{color:#111315}
.divar-toolbar-result button{border:0;background:transparent;color:#7a5220;cursor:pointer;font:inherit;font-size:.78rem;text-decoration:underline}
.divar-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px 20px}
.divar-card{display:flex;flex-direction:column;border:1px solid rgb(0 0 0 / .1);border-radius:18px;overflow:hidden;background:#fff;transition:border-color .18s,transform .18s}
.divar-card:hover{border-color:rgba(183,123,72,.45)}
.divar-image{position:relative;aspect-ratio:16/10;background:#0f1114;overflow:hidden}
.divar-image img{width:100%;height:100%;object-fit:cover;display:block}
.divar-image-fallback{position:absolute;inset:0;display:grid;place-items:center;color:#6f7276}
.divar-gallery-strip{position:absolute;inset-inline:0;bottom:0;display:flex;gap:6px;padding:8px;background:linear-gradient(to top,rgba(8,10,12,.82),transparent)}
.divar-gallery-thumb{width:44px;height:34px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.22);background:#15181c;padding:0;cursor:pointer;opacity:.7;transition:opacity .15s,border-color .15s}
.divar-gallery-thumb:hover{opacity:1}
.divar-gallery-thumb.is-active{opacity:1;border-color:#e8cd8f}
.divar-gallery-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.divar-gallery-more{display:grid;place-items:center;min-width:44px;height:34px;padding:0 8px;border-radius:8px;border:1px dashed rgba(255,255,255,.25);color:#f0e6d4;font-size:.7rem;background:rgba(8,10,12,.6)}
.divar-status{position:absolute;top:10px;inset-inline-end:10px;display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 10px;background:rgba(8,10,12,.76);font-size:.7rem;font-weight:700}
.divar-status.imported{color:#9fe0b6}
.divar-status.accepted{color:#e8cd8f}
.divar-media-badge{position:absolute;top:10px;inset-inline-start:10px;display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 10px;background:rgba(8,10,12,.76);font-size:.7rem;color:#e7e3da}
.divar-body{display:flex;flex-direction:column;gap:11px;padding:16px}
.divar-title{margin:0;font-size:17px;line-height:1.7;color:#111315}
.divar-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:rgb(0 0 0 / .62);font-size:.78rem}
.divar-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid rgb(0 0 0 / .12);background:rgb(0 0 0 / .03);border-radius:999px;padding:4px 9px}
.divar-price{display:flex;gap:12px;flex-wrap:wrap;font-size:.84rem;font-weight:800;color:#7a5220}
.divar-features{display:flex;gap:6px;flex-wrap:wrap}
.divar-feature{font-size:.72rem;color:rgb(0 0 0 / .68);background:rgb(0 0 0 / .05);border-radius:8px;padding:4px 8px}
.divar-description{margin:0;color:rgb(0 0 0 / .58);line-height:1.9;font-size:.8rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.divar-mini{display:flex;align-items:center;gap:6px;color:rgb(0 0 0 / .5);font-size:.72rem}
.divar-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
.divar-progress{display:flex;flex-direction:column;gap:7px;padding:11px 13px;border-radius:12px;background:rgb(0 0 0 / .04);border:1px solid rgb(0 0 0 / .09)}
.divar-progress-bar{height:5px;border-radius:999px;background:rgb(0 0 0 / .1);overflow:hidden}
.divar-progress-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#111315,#4a4f55);transition:width .3s ease}
.divar-progress small{color:rgb(0 0 0 / .68);font-size:.74rem}
.divar-progress-bar.is-indeterminate span{width:35%;animation:divar-indeterminate 1.2s ease-in-out infinite}
@keyframes divar-indeterminate{0%{margin-inline-start:-35%}100%{margin-inline-start:100%}}
.divar-note,.divar-warning{padding:13px 15px;border-radius:14px;line-height:1.9;font-size:.8rem}
.divar-note{background:rgba(24,122,88,.07);border:1px solid rgba(24,122,88,.18);color:#14503a}
.divar-warning{background:rgba(154,99,47,.08);border:1px solid rgba(154,99,47,.2);color:#6f4318}
.divar-hosted-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 8px;font-size:.68rem;font-weight:700;background:rgba(24,122,88,.11);color:#17603f}
@media (max-width:1080px){.divar-grid{grid-template-columns:1fr}.divar-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.divar-hero{flex-direction:column}.divar-hero-actions{justify-content:flex-start}.divar-hero h2{font-size:22px}}
@media (max-width:560px){.divar-stat-grid{grid-template-columns:1fr}.divar-grid{padding:14px}.divar-smart-toolbar,.divar-toolbar{padding:14px}}
`;

function formatMoney(value: string | null) {
  if (!value) return "توافقی";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("fa-IR") + " تومان";
}

function propertyLabel(file: DivarFile) {
  return file.propertyType === "villa" ? "ویلا" : "آپارتمان";
}

function transactionLabel(file: DivarFile) {
  return file.transactionType === "rent" ? "رهن و اجاره" : "فروش";
}

/** Grid image with the same fallback chain used on the public site. */
function DivarImage({
  src,
  className,
  onFailed,
}: {
  src: string;
  className?: string;
  onFailed?: () => void;
}) {
  const candidates = useMemo(() => mediaSourceCandidates(src), [src]);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[Math.min(attempt, Math.max(candidates.length - 1, 0))] ?? src;

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (attempt < candidates.length - 1) setAttempt((value) => value + 1);
        else onFailed?.();
      }}
    />
  );
}

/** Primary image plus a thumbnail strip so every imported photo is visible. */
function DivarGallery({ images, badge }: { images: string[]; badge: string }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const list = images.slice(0, 8);

  useEffect(() => {
    setActive(0);
    setBroken({});
  }, [images]);

  const primary = list[Math.min(active, Math.max(list.length - 1, 0))] ?? "";
  const extra = Math.max(0, images.length - list.length);

  return (
    <div className="divar-image">
      {primary && !broken[active] ? (
        <DivarImage
          src={primary}
          onFailed={() => setBroken((prev) => ({ ...prev, [active]: true }))}
        />
      ) : (
        <div className="divar-image-fallback">
          <ImageIcon size={40} />
        </div>
      )}

      <span className="divar-media-badge">
        <Images size={12} />
        {images.length.toLocaleString("fa-IR")} تصویر
      </span>

      <span className={`divar-status ${badge}`}>
        {badge === "imported" ? (
          <>
            <BadgeCheck size={12} /> منتشرشده
          </>
        ) : (
          <>
            <Sparkles size={12} /> آماده انتشار
          </>
        )}
      </span>

      {list.length > 1 ? (
        <div className="divar-gallery-strip">
          {list.map((image, imageIndex) => (
            <button
              key={`${image}-${imageIndex}`}
              type="button"
              className={imageIndex === active ? "divar-gallery-thumb is-active" : "divar-gallery-thumb"}
              onClick={() => setActive(imageIndex)}
              title={`تصویر ${imageIndex + 1}`}
            >
              <DivarImage src={image} />
            </button>
          ))}
          {extra > 0 ? <span className="divar-gallery-more">+{extra.toLocaleString("fa-IR")}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function featureSummary(file: DivarFile) {
  const fallback = [
    file.parking ? "پارکینگ" : null,
    file.elevator ? "آسانسور" : null,
    file.storage ? "انباری" : null,
  ].filter(Boolean) as string[];
  return (file.features.length ? file.features : fallback).slice(0, 6);
}

export function AdminDivarFiles() {
  const [files, setFiles] = useState<DivarFile[]>([]);
  const [imported, setImported] = useState<DivarFile[]>([]);
  const [stats, setStats] = useState({
    accepted: 0,
    imported: 0,
    rejected: 0,
    totalSeen: 0,
    lastSyncAt: null as string | null,
  });
  const [tab, setTab] = useState<"accepted" | "imported">("accepted");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStage, setImportStage] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [limit, setLimit] = useState(24);
  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<"all" | "sell" | "rent">("all");
  const [propertyFilter, setPropertyFilter] = useState<"all" | "apartment" | "villa">("all");
  const [sortBy, setSortBy] = useState<"newest" | "priceAsc" | "priceDesc" | "areaDesc">("newest");
  const [onlyWithImages, setOnlyWithImages] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acceptedRows, importedRows, nextStats] = await Promise.all([
        listDivarFiles({ data: { status: "accepted", limit: 100 } }),
        listDivarFiles({ data: { status: "imported", limit: 100 } }),
        getDivarStats({ data: {} }),
      ]);
      setFiles(acceptedRows);
      setImported(importedRows);
      setStats(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری فایل‌های دیوار انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const result = await syncDivarFiles({ data: { limit } });
      toast.success(
        `${result.accepted.toLocaleString("fa-IR")} فایل شخصی آماده انتشار شد و ${result.rejected.toLocaleString("fa-IR")} مورد مشاور/آژانس کنار گذاشته شد.`,
      );
      await load();
      setTab("accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت فایل‌ها از دیوار انجام نشد.");
    } finally {
      setSyncing(false);
    }
  }

  async function importFile(file: DivarFile, options: { repair?: boolean } = {}) {
    // Imported files can be re-processed intentionally so failed Divar images
    // can be downloaded again.
    if (!options.repair && imported.some((item) => item.id === file.id)) {
      toast.info("این فایل قبلاً وارد سایت شده است.");
      return;
    }

    setImportingId(file.id);
    setImportProgress(8);
    setImportStage("بررسی فایل دیوار…");

    // The import downloads a whole gallery, so the bar advances on a timer and
    // snaps to 100% when the server answers.
    const ticker = window.setInterval(() => {
      setImportProgress((value) => {
        const next = value + Math.max(2, (92 - value) * 0.12);
        return next > 92 ? 92 : next;
      });
      setImportStage((stage) =>
        stage === "بررسی فایل دیوار…" ? "دریافت و ذخیره تصاویر…" : stage,
      );
    }, 600);

    try {
      const result = await importDivarFile({
        data: { id: file.id, repair: options.repair === true },
      });
      setImportProgress(100);
      setImportStage("انتشار در سایت…");

      const hosted = "hostedImageCount" in result ? Number(result.hostedImageCount) || 0 : 0;
      const total = Number(result.imageCount) || 0;

      if (result.imageFailures > 0) {
        toast.warning(
          `فایل منتشر شد؛ ${hosted.toLocaleString("fa-IR")} تصویر روی فضای سایت ذخیره شد و ${result.imageFailures.toLocaleString("fa-IR")} تصویر با منبع اصلی نمایش داده می‌شود.`,
        );
      } else if (total > 0) {
        toast.success(
          result.alreadyImported
            ? `تصاویر تکمیل شد؛ مجموعه کامل ${total.toLocaleString("fa-IR")} تصویر روی سایت منتشر است.`
            : `فایل در سایت منتشر شد و ${total.toLocaleString("fa-IR")} تصویر ذخیره شد.`,
        );
      } else {
        toast.info("فایل در سایت منتشر شد، اما آگهی دیوار تصویری نداشت.");
      }

      await load();
      setTab("imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود فایل به سایت انجام نشد.");
    } finally {
      window.clearInterval(ticker);
      setImportingId(null);
      setImportStage("");
      setImportProgress(0);
    }
  }

  const sourceVisible = tab === "accepted" ? files : imported;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = sourceVisible.filter((file) => {
      if (transactionFilter !== "all" && file.transactionType !== transactionFilter) return false;
      if (propertyFilter !== "all" && file.propertyType !== propertyFilter) return false;
      if (onlyWithImages && file.images.length === 0) return false;
      if (!query) return true;
      const haystack = [
        file.title,
        file.neighborhood,
        file.description,
        file.sellerName ?? "",
        ...file.features,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "areaDesc") return (b.areaM2 ?? -1) - (a.areaM2 ?? -1);
      const aPrice = Number(a.price ?? a.deposit ?? a.rent ?? 0);
      const bPrice = Number(b.price ?? b.deposit ?? b.rent ?? 0);
      if (sortBy === "priceAsc") return aPrice - bPrice;
      if (sortBy === "priceDesc") return bPrice - aPrice;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
  }, [onlyWithImages, propertyFilter, search, sortBy, sourceVisible, transactionFilter]);

  const resetFilters = () => {
    setSearch("");
    setTransactionFilter("all");
    setPropertyFilter("all");
    setSortBy("newest");
    setOnlyWithImages(false);
  };

  const hasFilters =
    search.trim().length > 0 ||
    transactionFilter !== "all" ||
    propertyFilter !== "all" ||
    sortBy !== "newest" ||
    onlyWithImages;

  const withImages = sourceVisible.filter((file) => file.images.length > 0).length;
  const totalImages = sourceVisible.reduce((sum, file) => sum + file.images.length, 0);

  const emptyText =
    tab === "accepted"
      ? "هنوز فایل شخصی جدیدی دریافت نشده. روی «دریافت فایل‌های دیوار» بزنید."
      : "هنوز فایل دیواری به سایت شما وارد نشده است.";

  const lastSyncLabel = stats.lastSyncAt
    ? new Date(stats.lastSyncAt).toLocaleString("fa-IR")
    : "هنوز همگام‌سازی نشده";

  return (
    <section className="divar-wrap">
      <style>{DIVAR_CSS}</style>

      <div className="divar-hero">
        <div>
          <span className="kicker">منبع فایل · Divar</span>
          <h2>فایل‌های دیوار</h2>
          <p>
            فایل‌های شخصی اصفهان از دیوار جمع‌آوری می‌شوند، فیلتر مشاور/آژانس روی آن‌ها
            اجرا می‌شود و بعد از تأیید، تمام تصاویر آگهی روی فضای سایت منتشر می‌شوند.
            تصویری که CDN دیوار ندهد، با منبع اصلی و پروکسی اختصاصی سایت نمایش داده
            می‌شود تا هیچ گالری‌ای ناقص نماند.
          </p>
        </div>
        <div className="divar-hero-actions">
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={syncing}>
            <option value={12}>۱۲ فایل</option>
            <option value={24}>۲۴ فایل</option>
            <option value={36}>۳۶ فایل</option>
            <option value={48}>۴۸ فایل</option>
          </select>
          <button type="button" className="btn-gold" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 size={16} className="admin-spin" /> : <RefreshCw size={16} />}
            {syncing ? "در حال بررسی دیوار…" : "دریافت فایل‌های دیوار"}
          </button>
        </div>
      </div>

      <div className="divar-stat-grid">
        <div className="divar-stat accepted">
          <span className="divar-stat-icon">
            <Sparkles size={17} />
          </span>
          <div>
            <small>آماده انتشار</small>
            <strong>{stats.accepted.toLocaleString("fa-IR")}</strong>
          </div>
        </div>
        <div className="divar-stat imported">
          <span className="divar-stat-icon">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <small>منتشرشده در سایت</small>
            <strong>{stats.imported.toLocaleString("fa-IR")}</strong>
          </div>
        </div>
        <div className="divar-stat rejected">
          <span className="divar-stat-icon">
            <ShieldCheck size={17} />
          </span>
          <div>
            <small>ردشده (مشاور/آژانس)</small>
            <strong>{stats.rejected.toLocaleString("fa-IR")}</strong>
          </div>
        </div>
        <div className="divar-stat synced">
          <span className="divar-stat-icon">
            <Clock3 size={17} />
          </span>
          <div>
            <small>آخرین بررسی</small>
            <strong style={{ fontSize: 14 }}>{lastSyncLabel}</strong>
          </div>
        </div>
      </div>

      <div className="divar-note">
        <ImageIcon size={15} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
        در این فهرست {withImages.toLocaleString("fa-IR")} فایل تصویر دارد و مجموعاً{" "}
        {totalImages.toLocaleString("fa-IR")} تصویر آماده انتشار است. با دکمه «تکمیل تصاویر»
        هر گالری ناقص دوباره از دیوار خوانده می‌شود.
      </div>

      <div className="admin-panel">
        <div className="divar-toolbar">
          <div>
            <span className="kicker">فهرست</span>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {tab === "accepted" ? "فایل‌های قابل انتشار" : "فایل‌های منتشرشده"}
            </h2>
          </div>
          <div className="divar-tabs">
            <button
              type="button"
              className={`divar-tab${tab === "accepted" ? " is-active" : ""}`}
              onClick={() => setTab("accepted")}
            >
              <Filter size={14} /> آماده انتشار <b>{files.length.toLocaleString("fa-IR")}</b>
            </button>
            <button
              type="button"
              className={`divar-tab${tab === "imported" ? " is-active" : ""}`}
              onClick={() => setTab("imported")}
            >
              <CheckCircle2 size={14} /> منتشرشده <b>{imported.length.toLocaleString("fa-IR")}</b>
            </button>
          </div>
        </div>

        <div className="divar-smart-toolbar">
          <label className="divar-search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو در عنوان، محله، توضیحات و امکانات…"
              aria-label="جستجو در فایل‌های دیوار"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="پاک کردن جستجو"
                style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            ) : null}
          </label>

          <div className="divar-filter-group">
            <label className="divar-select-field">
              <span>معامله</span>
              <select
                value={transactionFilter}
                onChange={(event) =>
                  setTransactionFilter(event.target.value as typeof transactionFilter)
                }
              >
                <option value="all">همه</option>
                <option value="sell">فروش</option>
                <option value="rent">رهن و اجاره</option>
              </select>
            </label>
            <label className="divar-select-field">
              <span>نوع ملک</span>
              <select
                value={propertyFilter}
                onChange={(event) =>
                  setPropertyFilter(event.target.value as typeof propertyFilter)
                }
              >
                <option value="all">همه</option>
                <option value="apartment">آپارتمان</option>
                <option value="villa">ویلا</option>
              </select>
            </label>
            <label className="divar-select-field">
              <span>مرتب‌سازی</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="newest">جدیدترین</option>
                <option value="priceAsc">قیمت کمتر</option>
                <option value="priceDesc">قیمت بیشتر</option>
                <option value="areaDesc">متراژ بیشتر</option>
              </select>
            </label>
          </div>

          <label className="divar-toggle">
            <input
              type="checkbox"
              checked={onlyWithImages}
              onChange={(event) => setOnlyWithImages(event.target.checked)}
            />
            <span>
              <ImageIcon size={14} /> فقط دارای تصویر
            </span>
          </label>

          <div className="divar-toolbar-result">
            <SlidersHorizontal size={14} />
            <strong>{visible.length.toLocaleString("fa-IR")}</strong>
            <span>مورد نمایش</span>
            {hasFilters ? (
              <button type="button" onClick={resetFilters}>
                پاک کردن فیلترها
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="admin-empty">
            <Loader2 size={26} className="admin-spin" />
            <strong>در حال بارگذاری فهرست دیوار…</strong>
          </div>
        ) : visible.length === 0 ? (
          <div className="admin-empty">
            <Sparkles size={28} />
            <strong>{emptyText}</strong>
            <p>فایل‌های شخصی در اینجا می‌آیند؛ فایل‌های مشاور/آژانس از فهرست حذف می‌شوند.</p>
            <button type="button" className="btn-gold" onClick={() => void sync()} disabled={syncing}>
              <RefreshCw size={16} />
              {syncing ? "در حال بررسی…" : "بررسی دوباره"}
            </button>
          </div>
        ) : (
          <div className="divar-grid">
            {visible.map((file) => {
              const features = featureSummary(file);
              const importing = importingId === file.id;
              return (
                <article className="divar-card" key={file.id}>
                  <DivarGallery images={file.images} badge={file.filterStatus} />

                  <div className="divar-body">
                    <h3 className="divar-title">{file.title}</h3>

                    <div className="divar-meta">
                      <span className="divar-chip">{transactionLabel(file)}</span>
                      <span className="divar-chip">{propertyLabel(file)}</span>
                      <span className="divar-chip">
                        <MapPin size={12} /> {file.neighborhood || "اصفهان"}
                      </span>
                      {file.areaM2 ? (
                        <span className="divar-chip">
                          {file.areaM2.toLocaleString("fa-IR")} متر
                        </span>
                      ) : null}
                      {file.bedrooms ? (
                        <span className="divar-chip">
                          {file.bedrooms.toLocaleString("fa-IR")} خواب
                        </span>
                      ) : null}
                    </div>

                    <div className="divar-price">
                      {file.transactionType === "rent" ? (
                        <>
                          {file.deposit ? <span>رهن: {formatMoney(file.deposit)}</span> : null}
                          {file.rent ? <span>اجاره: {formatMoney(file.rent)}</span> : null}
                        </>
                      ) : (
                        <span>قیمت: {formatMoney(file.price)}</span>
                      )}
                    </div>

                    {features.length ? (
                      <div className="divar-features">
                        {features.map((feature) => (
                          <span key={feature} className="divar-feature">
                            {feature}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <p className="divar-description">{file.description}</p>

                    <div className="divar-meta">
                      <span className="divar-mini">
                        <Clock3 size={13} /> آخرین مشاهده:{" "}
                        {new Date(file.lastSeenAt).toLocaleDateString("fa-IR")}
                      </span>
                      {file.filterStatus === "imported" && file.images.length > 0 ? (
                        <span className="divar-hosted-badge">
                          <BadgeCheck size={12} /> گالری منتشرشده
                        </span>
                      ) : null}
                    </div>

                    {importing ? (
                      <div className="divar-progress" role="status">
                        <div
                          className={
                            importProgress >= 92
                              ? "divar-progress-bar is-indeterminate"
                              : "divar-progress-bar"
                          }
                        >
                          <span
                            style={
                              importProgress >= 92 ? undefined : { width: importProgress + "%" }
                            }
                          />
                        </div>
                        <small>{importStage || "در حال پردازش…"}</small>
                      </div>
                    ) : null}

                    <div className="divar-actions">
                      <a className="btn-ghost" href={file.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} /> مشاهده در دیوار
                      </a>
                      {file.latitude != null && file.longitude != null ? (
                        <a
                          className="btn-ghost"
                          href={`https://www.google.com/maps?q=${file.latitude},${file.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin size={15} /> نقشه
                        </a>
                      ) : null}

                      {tab === "accepted" ? (
                        <button
                          type="button"
                          className="btn-gold"
                          disabled={importing}
                          onClick={() => void importFile(file)}
                        >
                          {importing ? (
                            <Loader2 size={15} className="admin-spin" />
                          ) : (
                            <UploadCloud size={15} />
                          )}
                          {importing ? "در حال انتشار…" : "انتشار در سایت"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={importing}
                            onClick={() => void importFile(file, { repair: true })}
                          >
                            {importing ? (
                              <Loader2 size={15} className="admin-spin" />
                            ) : (
                              <UploadCloud size={15} />
                            )}
                            {importing ? "در حال تکمیل تصاویر…" : "تکمیل تصاویر / انتشار"}
                          </button>
                          {file.importedPropertyId ? (
                            <a
                              className="btn-ghost"
                              href={propertyPath({
                                id: file.importedPropertyId,
                                slug: file.propertySlug ?? "",
                              })}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Import size={15} /> مشاهده فایل سایت
                            </a>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="divar-warning">
        <ShieldCheck size={15} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
        فیلتر مشاور عمداً سخت‌گیرانه است: نوع «مشاور املاک» از داده دیوار رد می‌شود و متن‌هایی
        مثل «مشاور املاک تماس نگیرد»، «املاک ...» و «آژانس ...» هم حذف می‌شوند. فایل ردشده
        وارد سایت یا رسانه‌های شما نمی‌شود.
      </div>
    </section>
  );
}
