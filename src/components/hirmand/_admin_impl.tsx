import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Copy,
  ExternalLink,
  FileEdit,
  Home,
  KeyRound,
  LayoutDashboard,
  Music2,
  UsersRound,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SITE, TEAM } from "@/lib/site";
import type { Property, PropertyType, PropertyTransaction } from "@/lib/properties";
import { deleteProperty, listAdminProperties, saveProperty } from "@/lib/properties";
import { toast, Toaster } from "sonner";
import { formatToman } from "@/lib/money";
import { AdminMediaField } from "@/components/hirmand/admin-media-field";
import { AdminConsultantPicker } from "@/components/hirmand/admin-consultant-picker";
import { AdminMusicManager } from "@/components/hirmand/admin-music-manager";
import { AdminLeadManager } from "@/components/hirmand/admin-lead-manager";
import { ADMIN_CSS } from "@/components/hirmand/admin-shell-css";

type PublishStatus = "draft" | "published" | "archived";
type ViewMode = "list" | "form" | "music" | "leads";

type FormState = {
  id?: string;
  adminKey: string;
  title: string;
  transactionType: PropertyTransaction;
  propertyType: PropertyType;
  neighborhood: string;
  address: string;
  areaM2: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  totalFloors: string;
  builtYear: string;
  parking: boolean;
  elevator: boolean;
  storage: boolean;
  price: string;
  deposit: string;
  rent: string;
  description: string;
  features: string;
  images: string;
  contactName: string;
  contactPhone: string;
  status: PublishStatus;
  featured: boolean;
};

const STATUS_LABEL: Record<PublishStatus, string> = {
  published: "منتشرشده",
  draft: "پیش‌نویس",
  archived: "بایگانی",
};
const TX_OPTIONS: { value: PropertyTransaction; label: string }[] = [
  { value: "sell", label: "فروش" },
  { value: "buy", label: "خرید (درخواست)" },
  { value: "rent", label: "اجاره" },
  { value: "mortgage", label: "رهن" },
];

function emptyForm(adminKey = ""): FormState {
  return {
    adminKey,
    title: "",
    transactionType: "sell",
    propertyType: "apartment",
    neighborhood: "",
    address: "",
    areaM2: "",
    bedrooms: "2",
    bathrooms: "1",
    floor: "",
    totalFloors: "",
    builtYear: "",
    parking: true,
    elevator: true,
    storage: false,
    price: "",
    deposit: "",
    rent: "",
    description: "",
    features: "نورگیر\nبازسازی‌شده",
    images: "",
    contactName: TEAM[0]?.name ?? "مشاور هیرمند",
    contactPhone: TEAM[0]?.phone ?? SITE.phone.mobile,
    status: "published",
    featured: false,
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
  return { valid, invalid };
}

function propertyToForm(property: Property, adminKey: string): FormState {
  return {
    id: property.id,
    adminKey,
    title: property.title,
    transactionType: property.transactionType,
    propertyType: property.propertyType,
    neighborhood: property.neighborhood,
    address: property.address ?? "",
    areaM2: property.areaM2 != null ? String(property.areaM2) : "",
    bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
    bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
    floor: property.floor != null ? String(property.floor) : "",
    totalFloors: property.totalFloors != null ? String(property.totalFloors) : "",
    builtYear: property.builtYear != null ? String(property.builtYear) : "",
    parking: property.parking,
    elevator: property.elevator,
    storage: property.storage,
    price: property.price != null ? String(property.price) : "",
    deposit: property.deposit != null ? String(property.deposit) : "",
    rent: property.rent != null ? String(property.rent) : "",
    description: property.description ?? "",
    features: (property.features ?? []).join("\n"),
    images: (property.images ?? []).join("\n"),
    contactName: property.contactName,
    contactPhone: property.contactPhone,
    status: property.status,
    featured: property.featured,
  };
}

export function AdminPropertiesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [listFilter, setListFilter] = useState<"all" | PublishStatus | "featured">("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());

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
    if (!key) {
      toast.error("کلید مدیریت را وارد کنید.");
      return;
    }
    setLoadingList(true);
    try {
      const rows = await listAdminProperties({ data: { adminKey: key, limit: 100 } });
      setAdminKey(key);
      setForm((prev) => ({ ...prev, adminKey: key }));
      setProperties(rows);
      setUnlocked(true);
      if (showToast) toast.success("ورود به پنل مدیریت موفق بود.");
    } catch (error) {
      setUnlocked(false);
      toast.error(error instanceof Error ? error.message : "کلید مدیریت نادرست است.");
    } finally {
      setLoadingList(false);
    }
  }

  function logout() {
    setUnlocked(false);
    setAdminKey("");
    setKeyInput("");
    setProperties([]);
    setForm(emptyForm());
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (listFilter === "featured" && !p.featured) return false;
      if (listFilter !== "all" && listFilter !== "featured" && p.status !== listFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.contactName.toLowerCase().includes(q)
      );
    });
  }, [properties, listFilter, query]);

  const stats = useMemo(() => {
    const published = properties.filter((p) => p.status === "published").length;
    const draft = properties.filter((p) => p.status === "draft").length;
    const archived = properties.filter((p) => p.status === "archived").length;
    const featured = properties.filter((p) => p.featured).length;
    return { total: properties.length, published, draft, archived, featured };
  }, [properties]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!adminKey) {
      toast.error("ابتدا وارد پنل شوید.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("عنوان فایل را وارد کنید.");
      return;
    }
    if (!form.neighborhood.trim()) {
      toast.error("محله را انتخاب یا وارد کنید.");
      return;
    }
    if (!form.contactName.trim() || !form.contactPhone.trim()) {
      toast.error("نام و تلفن مشاور را مشخص کنید.");
      return;
    }
    const { valid: images, invalid } = parseImageUrls(form.images);
    if (invalid.length) {
      toast.error("برخی لینک‌های تصویر/ویدیو معتبر نیستند.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveProperty({
        data: {
          adminKey,
          id: form.id,
          title: form.title.trim(),
          transactionType: form.transactionType,
          propertyType: form.propertyType,
          neighborhood: form.neighborhood.trim(),
          address: form.address.trim() || undefined,
          areaM2: numberOrNull(form.areaM2),
          bedrooms: numberOrNull(form.bedrooms),
          bathrooms: numberOrNull(form.bathrooms),
          floor: numberOrNull(form.floor),
          totalFloors: numberOrNull(form.totalFloors),
          builtYear: numberOrNull(form.builtYear),
          parking: form.parking,
          elevator: form.elevator,
          storage: form.storage,
          price: numberOrNull(form.price),
          deposit: numberOrNull(form.deposit),
          rent: numberOrNull(form.rent),
          description: form.description.trim(),
          features: splitLines(form.features),
          images,
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          status: form.status,
          featured: form.featured,
        },
      });
      toast.success(form.id ? "فایل به‌روزرسانی شد." : "فایل جدید ذخیره شد.");
      setForm(propertyToForm(result, adminKey));
      await refresh(adminKey);
      setView("list");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setForm(emptyForm(adminKey));
    setView("form");
  }

  function editProperty(property: Property) {
    setForm(propertyToForm(property, adminKey));
    setView("form");
  }

  function duplicateProperty(property: Property) {
    const base = propertyToForm(property, adminKey);
    setForm({
      ...base,
      id: undefined,
      title: `${base.title} (کپی)`,
      status: "draft",
      featured: false,
    });
    setView("form");
  }

  async function removeProperty(property: Property) {
    if (!confirm(`حذف «${property.title}»؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await deleteProperty({ data: { adminKey, id: property.id } });
      toast.success("فایل حذف شد.");
      if (form.id === property.id) setForm(emptyForm(adminKey));
      await refresh(adminKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف انجام نشد.");
    }
  }

  if (!unlocked) {
    return (
      <div className="admin-login">
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
        <div className="admin-login-card">
          <span className="kicker">پنل داخلی هیرمند</span>
          <h1>ورود به مدیریت</h1>
          <p>کلید HIRMAND_ADMIN_KEY را وارد کنید.</p>
          <div className="admin-key-row">
            <input
              type="password"
              dir="ltr"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
              placeholder="HIRMAND_ADMIN_KEY"
            />
            <button
              type="button"
              className="btn-gold"
              disabled={loadingList || !keyInput.trim()}
              onClick={() => void unlock()}
            >
              {loadingList ? <RefreshCw size={16} className="admin-spin" /> : <KeyRound size={16} />}
              ورود
            </button>
          </div>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link to="/" className="btn-ghost">
              بازگشت به سایت
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <Toaster position="top-center" dir="rtl" richColors closeButton />
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Building2 size={22} color="#c9a24a" />
          <div>
            <strong>هیرمند</strong>
            <small>پنل مدیریت فایل‌ها</small>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={`admin-nav-btn${view === "list" ? " is-active" : ""}`}
            onClick={() => setView("list")}
          >
            <LayoutDashboard size={18} />
            فهرست فایل‌ها
          </button>
          <button
            type="button"
            className={`admin-nav-btn${view === "form" && !form.id ? " is-active" : ""}`}
            onClick={startNew}
          >
            <Plus size={18} />
            افزودن فایل
          </button>
          {form.id ? (
            <button
              type="button"
              className={`admin-nav-btn${view === "form" && form.id ? " is-active" : ""}`}
              onClick={() => setView("form")}
            >
              <FileEdit size={18} />
              ویرایش فعلی
            </button>
          ) : null}
          <button type="button" className={"admin-nav-btn" + (view === "music" ? " is-active" : "")} onClick={() => setView("music")}>
            <Music2 size={18} />
            موسیقی سایت
          </button>
          <button type="button" className={"admin-nav-btn" + (view === "leads" ? " is-active" : "")} onClick={() => setView("leads")}>
            <UsersRound size={18} />
            درخواست‌ها
          </button>
        </nav>
        <div className="admin-sidebar-foot">
          <button
            type="button"
            className="admin-nav-btn"
            onClick={() => void refresh()}
            disabled={loadingList}
          >
            <RefreshCw size={18} className={loadingList ? "admin-spin" : undefined} />
            به‌روزرسانی
          </button>
          <Link to="/" className="admin-nav-btn">
            <Home size={18} />
            سایت
          </Link>
          <button type="button" className="admin-nav-btn" onClick={logout}>
            <LogOut size={18} />
            خروج
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>
              {view === "list"
                ? "فهرست فایل‌ها"
                : view === "music"
                  ? "موسیقی سایت"
                  : view === "leads"
                    ? "درخواست‌های مشتری"
                    : form.id
                    ? "ویرایش فایل"
                    : "افزودن فایل جدید"}
            </h1>
            <p>
              {view === "list"
                ? `${stats.total.toLocaleString("fa-IR")} فایل در سیستم`
                : view === "leads"
                  ? "مدیریت Leadها و پیگیری مشتریان"
                  : form.contactName
                  ? `مشاور مسئول: ${form.contactName}`
                  : "مشاور مسئول را انتخاب کنید"}
            </p>
          </div>
          <div className="admin-topbar-actions">
            {view === "list" ? (
              <button type="button" className="btn-gold" onClick={startNew}>
                <Plus size={16} />
                فایل جدید
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setView("list")}>
                <X size={16} />
                بستن فرم
              </button>
            )}
          </div>
        </header>

        <div className="admin-content">
          {view === "list" ? (
            <>
              <div className="admin-stats-grid">
                {(
                  [
                    { key: "all" as const, label: "همه", value: stats.total, tone: undefined },
                    { key: "published" as const, label: "منتشرشده", value: stats.published, tone: "green" as const },
                    { key: "draft" as const, label: "پیش‌نویس", value: stats.draft, tone: "amber" as const },
                    { key: "featured" as const, label: "ویژه", value: stats.featured, tone: "gold" as const },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`admin-stat-card${listFilter === item.key ? " is-active" : ""}`}
                    data-tone={item.tone}
                    onClick={() => setListFilter(item.key)}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value.toLocaleString("fa-IR")}</strong>
                  </button>
                ))}
              </div>

              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <span className="kicker">فایل‌ها</span>
                    <h2>{filtered.length.toLocaleString("fa-IR")} مورد</h2>
                  </div>
                  <div className="admin-list-toolbar">
                    <label className="admin-search">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="جستجو عنوان، محله، مشاور…"
                      />
                    </label>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="admin-empty">
                    <Building2 size={28} />
                    <strong>فایلی نیست</strong>
                    <p>فیلتر را عوض کنید یا فایل جدید اضافه کنید.</p>
                    <button type="button" className="btn-gold" onClick={startNew}>
                      <Plus size={16} />
                      افزودن فایل
                    </button>
                  </div>
                ) : (
                  <div className="admin-property-list">
                    {filtered.map((property) => (
                      <article key={property.id} className="admin-property-card">
                        <div className="admin-property-thumb">
                          <img
                            src={property.images[0] || "/images/type-apartment.jpg"}
                            alt=""
                            loading="lazy"
                          />
                        </div>
                        <div className="admin-property-meta">
                          <div className="admin-property-tags">
                            <span data-status={property.status}>
                              {STATUS_LABEL[property.status]}
                            </span>
                            {property.featured ? <span data-featured>ویژه</span> : null}
                          </div>
                          <h3>{property.title}</h3>
                          <p>
                            {property.neighborhood} · {property.contactName}
                          </p>
                        </div>
                        <div className="admin-property-actions">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="ویرایش"
                            onClick={() => editProperty(property)}
                          >
                            <FileEdit size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="کپی"
                            onClick={() => duplicateProperty(property)}
                          >
                            <Copy size={16} />
                          </button>
                          <a
                            className="admin-icon-btn"
                            title="مشاهده عمومی"
                            href={`/properties/${property.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            type="button"
                            className="admin-icon-btn danger"
                            title="حذف"
                            onClick={() => void removeProperty(property)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {view === "music" ? <AdminMusicManager adminKey={adminKey} /> : null}
          {view === "leads" ? <AdminLeadManager adminKey={adminKey} /> : null}

          {view === "form" ? (
            <form className="admin-form-wrap" onSubmit={onSubmit}>
              <div className="admin-form-sections">
                <fieldset className="admin-section">
                  <legend>اطلاعات اصلی</legend>
                  <div className="admin-form-grid">
                    <label className="field admin-span-2">
                      <span>عنوان</span>
                      <input
                        value={form.title}
                        onChange={(e) => update("title", e.target.value)}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>نوع معامله</span>
                      <select
                        value={form.transactionType}
                        onChange={(e) =>
                          update("transactionType", e.target.value as PropertyTransaction)
                        }
                      >
                        {TX_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>نوع ملک</span>
                      <select
                        value={form.propertyType}
                        onChange={(e) => update("propertyType", e.target.value as PropertyType)}
                      >
                        {PROPERTY_TYPES.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>محله</span>
                      <input
                        list="neighborhood-list"
                        value={form.neighborhood}
                        onChange={(e) => update("neighborhood", e.target.value)}
                        required
                      />
                      <datalist id="neighborhood-list">
                        {NEIGHBORHOOD_NAMES.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field">
                      <span>آدرس</span>
                      <input
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                      />
                    </label>
                    <label className="field admin-span-2">
                      <span>توضیحات</span>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="admin-section">
                  <legend>مشخصات</legend>
                  <div className="admin-form-grid admin-form-grid-dense">
                    <label className="field">
                      <span>متراژ (م²)</span>
                      <input value={form.areaM2} onChange={(e) => update("areaM2", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>خواب</span>
                      <input value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>سرویس</span>
                      <input value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>طبقه</span>
                      <input value={form.floor} onChange={(e) => update("floor", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>کل طبقات</span>
                      <input value={form.totalFloors} onChange={(e) => update("totalFloors", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>سال ساخت</span>
                      <input value={form.builtYear} onChange={(e) => update("builtYear", e.target.value)} />
                    </label>
                  </div>
                  <div className="admin-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.parking}
                        onChange={(e) => update("parking", e.target.checked)}
                      />
                      پارکینگ
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.elevator}
                        onChange={(e) => update("elevator", e.target.checked)}
                      />
                      آسانسور
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.storage}
                        onChange={(e) => update("storage", e.target.checked)}
                      />
                      انباری
                    </label>
                  </div>
                </fieldset>

                <fieldset className="admin-section">
                  <legend>قیمت</legend>
                  <div className="admin-form-grid">
                    <label className="field">
                      <span>قیمت فروش (تومان)</span>
                      <input value={form.price} onChange={(e) => update("price", e.target.value)} />
                      {numberOrNull(form.price) != null ? (
                        <small className="admin-money-hint">{formatToman(numberOrNull(form.price)!)}
                        </small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>رهن (تومان)</span>
                      <input value={form.deposit} onChange={(e) => update("deposit", e.target.value)} />
                    </label>
                    <label className="field">
                      <span>اجاره ماهانه (تومان)</span>
                      <input value={form.rent} onChange={(e) => update("rent", e.target.value)} />
                    </label>
                    <label className="field admin-span-2">
                      <span>ویژگی‌ها (هر خط یک مورد)</span>
                      <textarea
                        rows={3}
                        value={form.features}
                        onChange={(e) => update("features", e.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="admin-section">
                  <legend>رسانه (تصویر و ویدیو)</legend>
                  <AdminMediaField
                    adminKey={adminKey}
                    value={form.images}
                    onChange={(next) => update("images", next)}
                  />
                </fieldset>

                <fieldset className="admin-section">
                  <legend>مشاور و وضعیت انتشار</legend>
                  <AdminConsultantPicker
                    contactName={form.contactName}
                    contactPhone={form.contactPhone}
                    onSelect={(member) => {
                      setForm((prev) => ({
                        ...prev,
                        contactName: member.name,
                        contactPhone: member.phone,
                      }));
                    }}
                  />
                  <div className="admin-form-grid" style={{ marginTop: 14 }}>
                    <label className="field">
                      <span>نام مشاور</span>
                      <input
                        value={form.contactName}
                        onChange={(e) => update("contactName", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>تلفن مشاور</span>
                      <input
                        dir="ltr"
                        value={form.contactPhone}
                        onChange={(e) => update("contactPhone", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>وضعیت</span>
                      <select
                        value={form.status}
                        onChange={(e) => update("status", e.target.value as PublishStatus)}
                      >
                        <option value="published">منتشرشده</option>
                        <option value="draft">پیش‌نویس</option>
                        <option value="archived">بایگانی</option>
                      </select>
                    </label>
                    <label
                      className="field"
                      style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 22 }}
                    >
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => update("featured", e.target.checked)}
                        style={{ accentColor: "#c9a24a", width: 18, height: 18 }}
                      />
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#e0c47a", fontWeight: 600 }}>
                        <Star size={15} /> فایل ویژه
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

              <div className="admin-sticky-bar">
                <div className="admin-sticky-bar-info">
                  مشاور: <strong>{form.contactName || "—"}</strong>
                </div>
                <div className="admin-sticky-actions">
                  <button type="button" className="btn-ghost" onClick={() => setView("list")}>
                    انصراف
                  </button>
                  <button type="submit" className="btn-gold" disabled={saving}>
                    {saving ? <RefreshCw size={16} className="admin-spin" /> : <Save size={16} />}
                    ذخیره
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <nav className="admin-mobile-nav">
        <button
          type="button"
          className={view === "list" ? "is-active" : ""}
          onClick={() => setView("list")}
        >
          <LayoutDashboard size={20} />
          فهرست
        </button>
        <button
          type="button"
          className={view === "form" && !form.id ? "is-active" : ""}
          onClick={startNew}
        >
          <Plus size={20} />
          جدید
        </button>
        <button type="button" className={view === "music" ? "is-active" : ""} onClick={() => setView("music")}>
          <Music2 size={20} />
          موسیقی
        </button>
        <button type="button" className={view === "leads" ? "is-active" : ""} onClick={() => setView("leads")}>
          <UsersRound size={20} />
          درخواست‌ها
        </button>
        <Link to="/">سایت</Link>
      </nav>
    </div>
  );
}
