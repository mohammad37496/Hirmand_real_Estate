import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  Home,
  Import,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
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
.divar-wrap{display:flex;flex-direction:column;gap:18px}
.divar-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:22px;border:1px solid rgba(201,162,74,.2);border-radius:18px;background:linear-gradient(135deg,rgba(201,162,74,.09),rgba(255,255,255,.02))}
.divar-hero h2{margin:3px 0 6px;font-size:24px}
.divar-hero p{margin:0;color:var(--admin-muted,#a7a7a7);max-width:760px;line-height:1.8}
.divar-hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.divar-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.divar-stat{padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
.divar-stat small{display:block;color:#9b9b9b;margin-bottom:8px}
.divar-stat strong{font-size:24px}
.divar-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.divar-tabs{display:flex;gap:6px;flex-wrap:wrap}
.divar-tab{border:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}
.divar-tab.is-active{background:rgba(201,162,74,.14);border-color:rgba(201,162,74,.35);color:#ead49a}
.divar-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.divar-card{border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;background:rgba(255,255,255,.025);display:flex;flex-direction:column}
.divar-image{position:relative;aspect-ratio:16/10;background:#101010;overflow:hidden}
.divar-image img{width:100%;height:100%;object-fit:cover;display:block}
.divar-image-placeholder{width:100%;height:100%;display:grid;place-items:center;color:#777}
.divar-status{position:absolute;top:10px;right:10px;border-radius:999px;padding:6px 9px;background:rgba(0,0,0,.7);font-size:12px}
.divar-status.imported{color:#a9e9bd}.divar-status.accepted{color:#ead49a}
.divar-body{padding:14px;display:flex;flex-direction:column;gap:10px}
.divar-title{font-size:17px;line-height:1.65;margin:0}
.divar-meta{display:flex;gap:8px;flex-wrap:wrap;color:#b6b6b6;font-size:13px}
.divar-chip{border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:4px 8px}
.divar-features{display:flex;gap:6px;flex-wrap:wrap}
.divar-feature{font-size:12px;color:#cfcfcf;background:rgba(255,255,255,.04);border-radius:8px;padding:4px 7px}
.divar-description{margin:0;color:#a8a8a8;line-height:1.85;font-size:13px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.divar-actions{display:flex;gap:8px;flex-wrap:wrap}
.divar-mini{font-size:12px;color:#888;display:flex;align-items:center;gap:5px}
.divar-note{padding:12px 14px;border-radius:12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.12);color:#b9dfc4;line-height:1.8}
.divar-warning{padding:12px 14px;border-radius:12px;background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.16);color:#e2d08d;line-height:1.8}
@media (max-width:980px){.divar-grid{grid-template-columns:1fr}.divar-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.divar-hero{flex-direction:column}.divar-hero-actions{justify-content:flex-start}}
@media (max-width:560px){.divar-stat-grid{grid-template-columns:1fr}.divar-toolbar{align-items:flex-start}.divar-hero h2{font-size:21px}}
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
  return file.transactionType === "rent" ? "اجاره" : "فروش";
}

function DivarImage({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const candidates = mediaSourceCandidates(src);
  const index = Math.min(attempt, Math.max(candidates.length - 1, 0));
  const current = candidates[index] ?? src;

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      onError={() => {
        if (attempt < candidates.length - 1) setAttempt((value) => value + 1);
      }}
    />
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
  const [limit, setLimit] = useState(24);

  async function load() {
    setLoading(true);
    try {
      const [acceptedRows, importedRows, nextStats] = await Promise.all([
        listDivarFiles({ data: { status: "accepted", limit: 60 } }),
        listDivarFiles({ data: { status: "imported", limit: 60 } }),
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
  }

  useEffect(() => {
    void load();
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const result = await syncDivarFiles({ data: { limit } });
      toast.success(
        `بررسی دیوار انجام شد؛ ${result.accepted.toLocaleString("fa-IR")} فایل شخصی پیدا شد و ${result.rejected.toLocaleString("fa-IR")} مورد مشاور/آژانس کنار گذاشته شد.`,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت فایل‌ها از دیوار انجام نشد.");
    } finally {
      setSyncing(false);
    }
  }

  async function importFile(file: DivarFile) {
    if (imported.some((item) => item.id === file.id)) {
      toast.info("این فایل قبلاً وارد سایت شده است.");
      return;
    }

    setImportingId(file.id);
    try {
      const result = await importDivarFile({ data: { id: file.id } });
      if (result.imageFailures > 0) {
        toast.warning(
          `فایل منتشر شد، اما ${result.imageFailures.toLocaleString("fa-IR")} تصویر از دیوار قابل دریافت نبود؛ دوباره روی «تکمیل تصاویر» بزنید.`,
        );
      } else {
        toast.success(
          result.imageCount > 0
            ? `فایل در سایت منتشر شد و ${result.imageCount.toLocaleString("fa-IR")} تصویر روی فضای رسانه سایت کپی شد.`
            : "فایل در سایت منتشر شد، اما تصویر قابل دریافت از دیوار پیدا نشد.",
        );
      }
      await load();
      setTab("imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود فایل به سایت انجام نشد.");
    } finally {
      setImportingId(null);
    }
  }

  const visible = tab === "accepted" ? files : imported;
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
            فایل‌های مسکونی اصفهان از فهرست عمومی دیوار جمع‌آوری می‌شوند. فیلتر اول روی
            «شخصی» است و یک فیلتر دوم هم کل متن داده‌های آگهی را برای نشانه‌های
            «مشاور املاک / آژانس / املاک ...» بررسی می‌کند.
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

      <div className="divar-note">
        <ShieldCheck size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
        فایل‌های ردشده اصلاً در فهرست قابل آپلود نمایش داده نمی‌شوند؛ تازه‌سازی هم قبل از
        ورود به سایت دوباره فیلتر مشاور/آژانس را اجرا می‌کند. فایل‌های واردشده مستقیماً منتشر می‌شوند؛ در صورت خطای CDN، منبع تصویر برای نمایش به‌عنوان پشتیبان حفظ می‌شود و بعداً با «تکمیل تصاویر» دوباره تلاش می‌کنیم.
      </div>

      <div className="divar-stat-grid">
        <div className="divar-stat"><small>فایل آماده ورود</small><strong>{stats.accepted.toLocaleString("fa-IR")}</strong></div>
        <div className="divar-stat"><small>واردشده به سایت</small><strong>{stats.imported.toLocaleString("fa-IR")}</strong></div>
        <div className="divar-stat"><small>ردشده به‌دلیل مشاور/آژانس</small><strong>{stats.rejected.toLocaleString("fa-IR")}</strong></div>
        <div className="divar-stat"><small>آخرین بررسی</small><strong style={{ fontSize: 14 }}>{lastSyncLabel}</strong></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">فهرست</span>
            <h2>{tab === "accepted" ? "فایل‌های قابل استفاده" : "فایل‌های واردشده"}</h2>
          </div>
          <div className="divar-tabs">
            <button type="button" className={`divar-tab${tab === "accepted" ? " is-active" : ""}`} onClick={() => setTab("accepted")}>
              <Filter size={14} style={{ verticalAlign: "middle" }} /> آماده ورود ({files.length.toLocaleString("fa-IR")})
            </button>
            <button type="button" className={`divar-tab${tab === "imported" ? " is-active" : ""}`} onClick={() => setTab("imported")}>
              <CheckCircle2 size={14} style={{ verticalAlign: "middle" }} /> واردشده ({imported.length.toLocaleString("fa-IR")})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty">
            <Loader2 size={26} className="admin-spin" />
            <strong>در حال بارگذاری فهرست دیوار…</strong>
          </div>
        ) : visible.length === 0 ? (
          <div className="admin-empty">
            <Globe2 size={28} />
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
                  <div className="divar-image">
                    {file.images[0] ? (
                      <DivarImage src={file.images[0]} />
                    ) : (
                      <div className="divar-image-placeholder"><Home size={42} /></div>
                    )}
                    <span className={`divar-status ${file.filterStatus}`}>
                      {file.filterStatus === "imported" ? "واردشده" : "شخصی · قابل استفاده"}
                    </span>
                  </div>

                  <div className="divar-body">
                    <h3 className="divar-title">{file.title}</h3>
                    <div className="divar-meta">
                      <span className="divar-chip">{transactionLabel(file)}</span>
                      <span className="divar-chip">{propertyLabel(file)}</span>
                      <span className="divar-chip">{file.neighborhood || "اصفهان"}</span>
                      {file.areaM2 ? <span className="divar-chip">{file.areaM2.toLocaleString("fa-IR")} متر</span> : null}
                      {file.bedrooms ? <span className="divar-chip">{file.bedrooms.toLocaleString("fa-IR")} خواب</span> : null}
                    </div>
                    <div className="divar-meta">
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
                        {features.map((feature) => <span key={feature} className="divar-feature">{feature}</span>)}
                      </div>
                    ) : null}
                    <p className="divar-description">{file.description}</p>
                    <div className="divar-mini">
                      <Clock3 size={13} /> {new Date(file.lastSeenAt).toLocaleDateString("fa-IR")}
                    </div>

                    <div className="divar-actions">
                      <a className="btn-ghost" href={file.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} /> مشاهده در دیوار
                      </a>
                      {tab === "accepted" ? (
                        <button
                          type="button"
                          className="btn-gold"
                          disabled={importing}
                          onClick={() => void importFile(file)}
                        >
                          {importing ? <Loader2 size={15} className="admin-spin" /> : <UploadCloud size={15} />}
                          {importing ? "در حال ورود و انتشار…" : "انتشار در سایت"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={importing}
                            onClick={() => void importFile(file)}
                          >
                            {importing ? <Loader2 size={15} className="admin-spin" /> : <UploadCloud size={15} />}
                            {importing ? "در حال تکمیل…" : "تکمیل تصاویر / انتشار"}
                          </button>
                          {file.importedPropertyId ? (
                            <a
                              className="btn-ghost"
                              href={file.importedPropertyId ? propertyPath({ id: file.importedPropertyId, slug: file.propertySlug ?? "" }) : "#"}
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
        <Sparkles size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} />
        فیلتر مشاور عمداً سخت‌گیرانه است: نوع «مشاور املاک» از داده دیوار رد می‌شود و
        متن‌هایی مثل «مشاور املاک تماس نگیرد»، «املاک ...» و «آژانس ...» هم حذف می‌شوند.
        فایل ردشده وارد سایت یا رسانه‌های شما نمی‌شود.
      </div>
    </section>
  );
}
