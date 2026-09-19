import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive, Check, Copy, ExternalLink, Eye, FileEdit, ImagePlus, KeyRound,
  LogOut, Plus, RefreshCw, Save, Search, Star, Trash2,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SITE, TEAM } from "@/lib/site";
import type { Property, PropertyType, PropertyTransaction } from "@/lib/properties";
import { deleteProperty, listAdminProperties, saveProperty } from "@/lib/properties";
import { toast, Toaster } from "sonner";
import { formatToman } from "@/lib/money";

const ADMIN_CSS = `
.admin-header-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.admin-stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.admin-stats button{border:1px solid rgba(255,255,255,.12);background:rgba(15,18,24,.7);color:var(--muted,#9aa3b2);border-radius:999px;padding:8px 14px;font-size:.85rem;cursor:pointer}
.admin-stats button strong{margin-inline-start:6px;color:var(--text,#eee)}
.admin-stats button.is-active{border-color:rgba(212,175,55,.5);color:#d4af37}
.admin-section{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px 16px 8px;margin-bottom:16px}
.admin-section legend{padding:0 8px;font-size:.85rem;color:#d4af37;font-weight:600}
.admin-form-grid-dense{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
.admin-span-2{grid-column:1/-1}
.admin-counter{float:left;opacity:.6;font-weight:400}
.admin-money-hint{display:block;margin-top:4px;color:#d4af37;font-size:.8rem}
.admin-image-preview{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 12px}
.admin-image-preview-item{width:88px;height:66px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#0a0c10}
.admin-image-preview-item img{width:100%;height:100%;object-fit:cover}
.admin-list-search{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 12px;background:rgba(15,18,24,.8);min-width:min(240px,100%)}
.admin-list-search input{border:0;background:transparent;color:inherit;outline:none;width:100%;font:inherit}
.admin-empty{text-align:center;padding:40px 16px;color:var(--muted,#9aa3b2)}
.admin-empty strong{display:block;color:var(--text,#eee);margin:10px 0 6px}
.admin-property-tags span[data-status="published"]{background:rgba(61,214,140,.2);color:#3dd68c}
.admin-property-tags span[data-status="draft"]{background:rgba(245,197,66,.18);color:#f5c542}
.admin-property-tags span[data-status="archived"]{background:rgba(154,163,178,.2);color:#9aa3b2}
.admin-property-tags span[data-featured]{background:rgba(212,175,55,.22);color:#d4af37}
.admin-form-head-actions{display:flex;flex-wrap:wrap;gap:8px}
@keyframes admin-spin{to{transform:rotate(360deg)}}
.admin-spin{animation:admin-spin .8s linear infinite}
`;

export const Route = createFileRoute("/admin")({
  component: AdminPropertiesPage,
  head: () => ({
    meta: [
      { title: `مدیریت فایل‌ها | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type PublishStatus = "draft" | "published" | "archived";

type FormState = {
  id?: string; adminKey: string; title: string; transactionType: PropertyTransaction;
  propertyType: PropertyType; neighborhood: string; address: string; areaM2: string;
  bedrooms: string; bathrooms: string; floor: string; totalFloors: string; builtYear: string;
  parking: boolean; elevator: boolean; storage: boolean; price: string; deposit: string; rent: string;
  description: string; features: string; images: string; contactName: string; contactPhone: string;
  status: PublishStatus; featured: boolean;
};

const STORAGE_KEY = "hirmand_admin_key";
const STATUS_LABEL: Record<PublishStatus, string> = {
  published: "منتشرشده", draft: "پیش‌نویس", archived: "بایگانی",
};
const TX_OPTIONS: { value: PropertyTransaction; label: string }[] = [
  { value: "sell", label: "فروش" },
  { value: "buy", label: "خرید (درخواست)" },
  { value: "rent", label: "اجاره" },
  { value: "mortgage", label: "رهن" },
];

function emptyForm(adminKey = ""): FormState {
  return {
    adminKey, title: "", transactionType: "sell", propertyType: "apartment", neighborhood: "",
    address: "", areaM2: "", bedrooms: "2", bathrooms: "1", floor: "", totalFloors: "", builtYear: "",
    parking: true, elevator: true, storage: false, price: "", deposit: "", rent: "",
    description: "", features: "نورگیر\nبازسازی‌شده", images: "",
    contactName: TEAM[0]?.name ?? "مشاور هیرمند", contactPhone: TEAM[0]?.phone ?? SITE.phone.mobile,
    status: "published", featured: false,
  };
}

function toEnglishDigits(raw: string) {
  return raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}
function numberOrNull(raw: string) {
  const digits = toEnglishDigits(raw).replace(/[^\d.-]/g, "");
  if (!digits.trim()) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}
function splitLines(raw: string) {
  return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}
function parseImageUrls(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const line of splitLines(raw)) {
    try {
      const u = new URL(line);
      if (u.protocol === "http:" || u.protocol === "https:") valid.push(line);
      else invalid.push(line);
    } catch {
      invalid.push(line);
    }
  }
  return { valid: valid.slice(0, 12), invalid };
}
function moneyLabel(raw: string | null) {
  if (!raw) return "—";
  const n = Number(raw);
  return Number.isFinite(n) ? `${formatToman(n)} تومان` : raw;
}
function propertyToForm(property: Property, adminKey: string): FormState {
  return {
    id: property.id, adminKey, title: property.title, transactionType: property.transactionType,
    propertyType: property.propertyType, neighborhood: property.neighborhood,
    address: property.address ?? "", areaM2: property.areaM2?.toString() ?? "",
    bedrooms: property.bedrooms?.toString() ?? "", bathrooms: property.bathrooms?.toString() ?? "",
    floor: property.floor?.toString() ?? "", totalFloors: property.totalFloors?.toString() ?? "",
    builtYear: property.builtYear?.toString() ?? "", parking: property.parking,
    elevator: property.elevator, storage: property.storage, price: property.price ?? "",
    deposit: property.deposit ?? "", rent: property.rent ?? "", description: property.description,
    features: property.features.join("\n"), images: property.images.join("\n"),
    contactName: property.contactName, contactPhone: property.contactPhone,
    status: property.status, featured: property.featured,
  };
}

function AdminPropertiesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | PublishStatus>("all");
  const [listQuery, setListQuery] = useState("");

  const stats = useMemo(() => ({
    total: properties.length,
    published: properties.filter((p) => p.status === "published").length,
    draft: properties.filter((p) => p.status === "draft").length,
    archived: properties.filter((p) => p.status === "archived").length,
  }), [properties]);

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (listFilter !== "all" && p.status !== listFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.neighborhood.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [properties, listFilter, listQuery]);

  const imagePreview = useMemo(() => parseImageUrls(form.images).valid.slice(0, 4), [form.images]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) { setKeyInput(saved); void unlock(saved, false); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function refresh(key = adminKey) {
    if (!key) return;
    setLoadingList(true);
    try {
      setProperties(await listAdminProperties({ data: { adminKey: key, limit: 100 } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری فایل‌ها انجام نشد.");
      throw error;
    } finally {
      setLoadingList(false);
    }
  }

  async function unlock(key = keyInput.trim(), showToast = true) {
    if (!key) { toast.error("کلید مدیریت را وارد کنید."); return; }
    setLoadingList(true);
    try {
      const rows = await listAdminProperties({ data: { adminKey: key, limit: 100 } });
      setAdminKey(key);
      setForm((prev) => ({ ...prev, adminKey: key }));
      setProperties(rows);
      setUnlocked(true);
      try { sessionStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
      if (showToast) toast.success("ورود به پنل مدیریت موفق بود.");
    } catch (error) {
      setUnlocked(false);
      toast.error(error instanceof Error ? error.message : "کلید مدیریت نادرست است.");
    } finally {
      setLoadingList(false);
    }
  }

  function logout() {
    setUnlocked(false); setAdminKey(""); setKeyInput(""); setProperties([]); setForm(emptyForm());
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.message("از پنل خارج شدید.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!adminKey) { toast.error("ابتدا با کلید مدیریت وارد شوید."); return; }
    if (form.title.trim().length < 3) { toast.error("عنوان باید حداقل ۳ کاراکتر باشد."); return; }
    if (form.neighborhood.trim().length < 2) { toast.error("محله را مشخص کنید."); return; }
    if (form.description.trim().length < 10) { toast.error("توضیحات باید حداقل ۱۰ کاراکتر باشد."); return; }
    const { valid: images, invalid } = parseImageUrls(form.images);
    if (invalid.length) {
      toast.error(`لینک تصویر نامعتبر: ${invalid[0]} — فقط URL کامل https://...`);
      return;
    }
    setLoading(true);
    try {
      const result = await saveProperty({
        data: {
          adminKey: form.adminKey || adminKey, id: form.id, title: form.title.trim(),
          transactionType: form.transactionType, propertyType: form.propertyType,
          neighborhood: form.neighborhood.trim(), address: form.address.trim(),
          areaM2: numberOrNull(form.areaM2), bedrooms: numberOrNull(form.bedrooms),
          bathrooms: numberOrNull(form.bathrooms), floor: numberOrNull(form.floor),
          totalFloors: numberOrNull(form.totalFloors), builtYear: numberOrNull(form.builtYear),
          parking: form.parking, elevator: form.elevator, storage: form.storage,
          price: toEnglishDigits(form.price).replace(/[^\d]/g, ""),
          deposit: toEnglishDigits(form.deposit).replace(/[^\d]/g, ""),
          rent: toEnglishDigits(form.rent).replace(/[^\d]/g, ""),
          description: form.description.trim(), features: splitLines(form.features), images,
          contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim(),
          status: form.status, featured: form.featured,
        },
      });
      setProperties((prev) =>
        prev.some((item) => item.id === result.id)
          ? prev.map((item) => (item.id === result.id ? result : item))
          : [result, ...prev],
      );
      setForm(propertyToForm(result, adminKey));
      toast.success(form.status === "published" ? "فایل منتشر شد و در سایت نمایش داده می‌شود." : "فایل ذخیره شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره فایل انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  function edit(property: Property) {
    setForm(propertyToForm(property, adminKey));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicate(property: Property) {
    const base = propertyToForm(property, adminKey);
    setForm({ ...base, id: undefined, title: `${property.title} (کپی)`, status: "draft", featured: false });
    toast.message("کپی آماده است — بعد از ویرایش ذخیره کنید.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(property: Property) {
    if (!adminKey) return;
    if (!window.confirm(`حذف «${property.title}»؟ این کار قابل بازگشت نیست.`)) return;
    setLoading(true);
    try {
      await deleteProperty({ data: { adminKey, id: property.id } });
      setProperties((prev) => prev.filter((item) => item.id !== property.id));
      if (form.id === property.id) setForm(emptyForm(adminKey));
      toast.success("فایل حذف شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function quickStatus(property: Property, status: PublishStatus) {
    if (!adminKey) return;
    setLoading(true);
    try {
      const result = await saveProperty({
        data: {
          adminKey, id: property.id, title: property.title, transactionType: property.transactionType,
          propertyType: property.propertyType, neighborhood: property.neighborhood,
          address: property.address ?? "", areaM2: property.areaM2, bedrooms: property.bedrooms,
          bathrooms: property.bathrooms, floor: property.floor, totalFloors: property.totalFloors,
          builtYear: property.builtYear, parking: property.parking, elevator: property.elevator,
          storage: property.storage, price: property.price ?? "", deposit: property.deposit ?? "",
          rent: property.rent ?? "", description: property.description, features: property.features,
          images: property.images, contactName: property.contactName, contactPhone: property.contactPhone,
          status, featured: property.featured,
        },
      });
      setProperties((prev) => prev.map((item) => (item.id === result.id ? result : item)));
      toast.success(`وضعیت به «${STATUS_LABEL[status]}» تغییر کرد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  const isRentLike = form.transactionType === "rent" || form.transactionType === "mortgage";
  const currentSlug = form.id ? properties.find((p) => p.id === form.id)?.slug : undefined;

  if (!unlocked) {
    return (
      <main className="admin-shell">
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
        <header className="admin-header">
          <div>
            <span className="kicker">پنل داخلی</span>
            <h1>مدیریت فایل‌های ملکی</h1>
            <p>برای ثبت و انتشار فایل‌ها، کلید مدیریت سرور را وارد کنید.</p>
          </div>
          <Link to="/" className="btn-ghost">بازگشت به سایت</Link>
        </header>
        <section className="admin-key-panel">
          <div>
            <KeyRound size={22} />
            <div>
              <strong>ورود امن</strong>
              <small>کلید همان مقدار HIRMAND_ADMIN_KEY در Vercel است.</small>
            </div>
          </div>
          <div className="admin-key-row">
            <input type="password" dir="ltr" autoComplete="current-password" placeholder="HIRMAND_ADMIN_KEY"
              value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }} />
            <button type="button" className="btn-gold" disabled={loadingList || !keyInput.trim()} onClick={() => void unlock()}>
              {loadingList ? "در حال بررسی..." : "ورود به مدیریت"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <Toaster position="top-center" dir="rtl" richColors closeButton />
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <header className="admin-header">
        <div>
          <span className="kicker">پنل داخلی</span>
          <h1>مدیریت فایل‌های ملکی</h1>
          <p>
            {stats.published.toLocaleString("fa-IR")} منتشر · {stats.draft.toLocaleString("fa-IR")} پیش‌نویس ·{" "}
            {stats.archived.toLocaleString("fa-IR")} بایگانی
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn-ghost" onClick={() => void refresh()} disabled={loadingList}>
            <RefreshCw size={16} className={loadingList ? "admin-spin" : undefined} /> به‌روزرسانی
          </button>
          <button type="button" className="btn-ghost" onClick={logout}><LogOut size={16} /> خروج</button>
          <Link to="/" className="btn-ghost">مشاهده سایت</Link>
        </div>
      </header>

      <div className="admin-stats">
        {(["all", "published", "draft", "archived"] as const).map((key) => (
          <button key={key} type="button" className={listFilter === key ? "is-active" : ""} onClick={() => setListFilter(key)}>
            {key === "all" ? "همه" : STATUS_LABEL[key]}{" "}
            <strong>{(key === "all" ? stats.total : stats[key]).toLocaleString("fa-IR")}</strong>
          </button>
        ))}
      </div>

      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-head">
          <div>
            <span className="kicker">{form.id ? "ویرایش فایل" : "فایل جدید"}</span>
            <h2>{form.id ? "ویرایش مشخصات ملک" : "ثبت و انتشار ملک جدید"}</h2>
          </div>
          <div className="admin-form-head-actions">
            {form.id ? (
              <button type="button" className="btn-ghost" onClick={() => setForm(emptyForm(adminKey))}>
                <Plus size={16} /> فایل جدید
              </button>
            ) : null}
          </div>
        </div>

        <fieldset className="admin-section">
          <legend>اطلاعات اصلی</legend>
          <div className="admin-form-grid">
            <label className="field admin-span-2">
              <span>عنوان فایل *</span>
              <input value={form.title} onChange={(e) => update("title", e.target.value)}
                placeholder="مثلاً: آپارتمان ۱۲۰ متری نوساز جلفا" required maxLength={180} />
            </label>
            <label className="field">
              <span>نوع معامله</span>
              <select value={form.transactionType} onChange={(e) => update("transactionType", e.target.value as PropertyTransaction)}>
                {TX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>نوع ملک</span>
              <select value={form.propertyType} onChange={(e) => update("propertyType", e.target.value as PropertyType)}>
                {PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="field">
              <span>محله *</span>
              <input list="admin-neighborhoods" value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} placeholder="مثلاً مرداویج" required />
              <datalist id="admin-neighborhoods">{NEIGHBORHOOD_NAMES.map((name) => <option key={name} value={name} />)}</datalist>
            </label>
            <label className="field">
              <span>آدرس دقیق (اختیاری)</span>
              <input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="خیابان، کوچه..." />
            </label>
            <label className="field admin-span-2">
              <span>توضیحات * <small className="admin-counter">{form.description.trim().length.toLocaleString("fa-IR")} / ۵۰۰۰</small></span>
              <textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)}
                placeholder="موقعیت، دسترسی، امکانات و نکات مهم..." required maxLength={5000} />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-section">
          <legend>مشخصات فیزیکی</legend>
          <div className="admin-form-grid admin-form-grid-dense">
            <label className="field"><span>متراژ (م²)</span><input inputMode="numeric" value={form.areaM2} onChange={(e) => update("areaM2", e.target.value)} /></label>
            <label className="field"><span>خواب</span><input inputMode="numeric" value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} /></label>
            <label className="field"><span>سرویس</span><input inputMode="numeric" value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} /></label>
            <label className="field"><span>طبقه</span><input inputMode="numeric" value={form.floor} onChange={(e) => update("floor", e.target.value)} /></label>
            <label className="field"><span>کل طبقات</span><input inputMode="numeric" value={form.totalFloors} onChange={(e) => update("totalFloors", e.target.value)} /></label>
            <label className="field"><span>سال ساخت</span><input inputMode="numeric" value={form.builtYear} onChange={(e) => update("builtYear", e.target.value)} /></label>
          </div>
          <div className="admin-checks">
            <label><input type="checkbox" checked={form.parking} onChange={(e) => update("parking", e.target.checked)} /> پارکینگ</label>
            <label><input type="checkbox" checked={form.elevator} onChange={(e) => update("elevator", e.target.checked)} /> آسانسور</label>
            <label><input type="checkbox" checked={form.storage} onChange={(e) => update("storage", e.target.checked)} /> انباری</label>
            <label><input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} /> <Star size={14} /> فایل ویژه</label>
          </div>
        </fieldset>

        <fieldset className="admin-section">
          <legend>قیمت و شرایط</legend>
          <div className="admin-form-grid admin-form-grid-dense">
            {!isRentLike ? (
              <label className="field">
                <span>قیمت فروش (تومان)</span>
                <input inputMode="numeric" dir="ltr" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="18500000000" />
                {numberOrNull(form.price) ? <small className="admin-money-hint">{formatToman(numberOrNull(form.price)!)} تومان</small> : null}
              </label>
            ) : null}
            <label className="field">
              <span>رهن (تومان)</span>
              <input inputMode="numeric" dir="ltr" value={form.deposit} onChange={(e) => update("deposit", e.target.value)} />
              {numberOrNull(form.deposit) ? <small className="admin-money-hint">{formatToman(numberOrNull(form.deposit)!)} تومان</small> : null}
            </label>
            {form.transactionType === "rent" ? (
              <label className="field">
                <span>اجاره ماهانه (تومان)</span>
                <input inputMode="numeric" dir="ltr" value={form.rent} onChange={(e) => update("rent", e.target.value)} />
                {numberOrNull(form.rent) ? <small className="admin-money-hint">{formatToman(numberOrNull(form.rent)!)} تومان</small> : null}
              </label>
            ) : null}
            <label className="field">
              <span>وضعیت نمایش</span>
              <select value={form.status} onChange={(e) => update("status", e.target.value as PublishStatus)}>
                <option value="published">منتشر شود (نمایش در سایت)</option>
                <option value="draft">پیش‌نویس (فقط ادمین)</option>
                <option value="archived">بایگانی</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-section">
          <legend>ویژگی‌ها و تصاویر</legend>
          <div className="admin-form-grid">
            <label className="field">
              <span>ویژگی‌ها</span>
              <textarea rows={5} value={form.features} onChange={(e) => update("features", e.target.value)} placeholder={"نورگیر\nبازسازی‌شده\nلابی"} />
              <small>هر ویژگی در یک خط</small>
            </label>
            <label className="field">
              <span>آدرس تصاویر (URL)</span>
              <textarea rows={5} value={form.images} onChange={(e) => update("images", e.target.value)}
                placeholder={"https://example.com/1.jpg\nhttps://example.com/2.jpg"} dir="ltr" />
              <small><ImagePlus size={12} style={{ display: "inline", verticalAlign: "middle" }} /> فقط https · تا ۱۲ تصویر</small>
            </label>
          </div>
          {imagePreview.length ? (
            <div className="admin-image-preview">
              {imagePreview.map((src) => (
                <div key={src} className="admin-image-preview-item">
                  <img src={src} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                </div>
              ))}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="admin-section">
          <legend>مشاور مسئول</legend>
          <div className="admin-form-grid admin-form-grid-dense">
            <label className="field">
              <span>نام مشاور *</span>
              <input list="admin-team" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} required />
              <datalist id="admin-team">{TEAM.map((p) => <option key={p.phone} value={p.name} />)}</datalist>
            </label>
            <label className="field">
              <span>شماره تماس *</span>
              <input dir="ltr" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} required placeholder="0913..." />
            </label>
          </div>
        </fieldset>

        <div className="admin-form-actions">
          <button type="submit" className="btn-gold" disabled={loading}>
            {loading ? "در حال ذخیره..." : (<><Save size={17} /> {form.id ? "ذخیره تغییرات" : form.status === "published" ? "انتشار فایل" : "ذخیره پیش‌نویس"}</>)}
          </button>
          {currentSlug ? (
            <Link to="/properties/$slug" params={{ slug: currentSlug }} className="btn-ghost" target="_blank">
              <ExternalLink size={16} /> باز کردن صفحه ملک
            </Link>
          ) : null}
        </div>
      </form>

      <section className="admin-list">
        <div className="admin-list-head">
          <div>
            <span className="kicker">فهرست فایل‌ها</span>
            <h2>{filtered.length.toLocaleString("fa-IR")} مورد{listFilter !== "all" ? ` · ${STATUS_LABEL[listFilter]}` : ""}</h2>
          </div>
          <div className="admin-list-search">
            <Search size={16} />
            <input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="جستجو عنوان یا محله..." />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="admin-empty">
            <FileEdit size={28} />
            <strong>فایلی با این فیلتر نیست</strong>
            <p>یک فایل جدید از فرم بالا ثبت کنید یا فیلتر را عوض کنید.</p>
          </div>
        ) : (
          <div className="admin-list-grid">
            {filtered.map((property) => (
              <article key={property.id} className="admin-property-row">
                <div className="admin-property-thumb">
                  <img src={property.images[0] || "/images/type-apartment.jpg"} alt="" loading="lazy" />
                </div>
                <div className="admin-property-info">
                  <div className="admin-property-tags">
                    <span data-status={property.status}>{STATUS_LABEL[property.status]}</span>
                    {property.featured ? <span data-featured>ویژه</span> : null}
                  </div>
                  <h3>{property.title}</h3>
                  <p>
                    {property.neighborhood}
                    {property.areaM2 ? ` · ${property.areaM2.toLocaleString("fa-IR")} متر` : ""}
                    {property.price ? ` · ${moneyLabel(property.price)}` : ""}
                  </p>
                </div>
                <div className="admin-property-actions">
                  <button type="button" className="btn-ghost" onClick={() => edit(property)}><Check size={15} /> ویرایش</button>
                  <button type="button" className="btn-ghost" onClick={() => duplicate(property)} title="کپی"><Copy size={15} /></button>
                  {property.status !== "published" ? (
                    <button type="button" className="btn-ghost" onClick={() => void quickStatus(property, "published")} title="انتشار"><Eye size={15} /></button>
                  ) : (
                    <button type="button" className="btn-ghost" onClick={() => void quickStatus(property, "archived")} title="بایگانی"><Archive size={15} /></button>
                  )}
                  <Link to="/properties/$slug" params={{ slug: property.slug }} className="btn-ghost" target="_blank"><ExternalLink size={15} /></Link>
                  <button type="button" className="danger-btn" onClick={() => void remove(property)} title="حذف"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="admin-footer">
        <Link to="/" className="text-link">بازگشت به سایت</Link>
      </footer>
    </main>
  );
}
