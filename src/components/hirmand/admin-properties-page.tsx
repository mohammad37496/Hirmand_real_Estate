import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileEdit,
  Home,
  KeyRound,
  LayoutDashboard,
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

const ADMIN_CSS = `
.admin-app{min-height:100vh;display:flex;background:#07090d;color:#f4efe6;font-family:var(--font,Vazirmatn,Tahoma,sans-serif)}
.admin-sidebar{width:240px;flex-shrink:0;border-left:1px solid rgba(244,239,230,.08);background:linear-gradient(180deg,#0c1016 0%,#07090d 100%);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:30}
.admin-sidebar-brand{padding:22px 18px 18px;border-bottom:1px solid rgba(244,239,230,.08);display:flex;align-items:center;gap:12px}
.admin-sidebar-brand strong{display:block;font-size:.95rem;font-weight:700}
.admin-sidebar-brand small{color:#7d766c;font-size:.72rem}
.admin-sidebar-nav{padding:14px 10px;display:flex;flex-direction:column;gap:4px;flex:1}
.admin-nav-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;border:0;background:transparent;color:#b7b0a4;font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;text-align:right;transition:background .15s,color .15s}
.admin-nav-btn:hover{background:rgba(255,255,255,.04);color:#f4efe6}
.admin-nav-btn.is-active{background:rgba(201,162,74,.12);color:#e0c47a}
.admin-nav-btn svg{flex-shrink:0;opacity:.85}
.admin-sidebar-foot{padding:14px 10px 18px;border-top:1px solid rgba(244,239,230,.08);display:flex;flex-direction:column;gap:4px}
.admin-main{flex:1;min-width:0;display:flex;flex-direction:column}
.admin-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid rgba(244,239,230,.08);background:rgba(7,9,13,.85);backdrop-filter:blur(12px);position:sticky;top:0;z-index:20}
.admin-topbar h1{font-size:1.15rem;font-weight:700;margin:0}
.admin-topbar p{margin:2px 0 0;color:#7d766c;font-size:.82rem}
.admin-topbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-content{padding:24px;flex:1}
.admin-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:24px}
.admin-stat-card{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.9);border-radius:16px;padding:18px 16px;cursor:pointer;transition:border-color .15s,background .15s}
.admin-stat-card:hover{border-color:rgba(201,162,74,.35)}
.admin-stat-card.is-active{border-color:rgba(201,162,74,.55);background:rgba(201,162,74,.08)}
.admin-stat-card span{display:block;color:#7d766c;font-size:.78rem;font-weight:600;margin-bottom:6px}
.admin-stat-card strong{font-size:1.55rem;font-weight:700;letter-spacing:-.02em}
.admin-stat-card[data-tone="green"] strong{color:#3dd68c}
.admin-stat-card[data-tone="amber"] strong{color:#f5c542}
.admin-stat-card[data-tone="muted"] strong{color:#9aa3b2}
.admin-stat-card[data-tone="gold"] strong{color:#e0c47a}
.admin-panel{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.75);border-radius:20px;overflow:hidden}
.admin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(244,239,230,.08);flex-wrap:wrap}
.admin-panel-head h2{margin:0;font-size:1.05rem;font-weight:700}
.admin-panel-head .kicker{display:block;color:#c9a24a;font-size:.72rem;font-weight:600;letter-spacing:.1em;margin-bottom:4px}
.admin-list-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.admin-search{display:flex;align-items:center;gap:8px;border:1px solid rgba(244,239,230,.12);border-radius:12px;padding:8px 12px;background:rgba(7,9,13,.6);min-width:min(260px,100%)}
.admin-search input{border:0;background:transparent;color:inherit;outline:none;width:100%;font:inherit;font-size:.9rem}
.admin-property-list{display:flex;flex-direction:column}
.admin-property-card{display:grid;grid-template-columns:88px 1fr auto;gap:16px;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(244,239,230,.06);transition:background .15s}
.admin-property-card:last-child{border-bottom:0}
.admin-property-card:hover{background:rgba(255,255,255,.025)}
.admin-property-thumb{width:88px;height:66px;border-radius:12px;overflow:hidden;background:#0a0c10;flex-shrink:0}
.admin-property-thumb img{width:100%;height:100%;object-fit:cover}
.admin-property-meta{min-width:0}
.admin-property-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.admin-property-tags span{font-size:.72rem;font-weight:600;padding:3px 9px;border-radius:999px}
.admin-property-tags span[data-status="published"]{background:rgba(61,214,140,.18);color:#3dd68c}
.admin-property-tags span[data-status="draft"]{background:rgba(245,197,66,.16);color:#f5c542}
.admin-property-tags span[data-status="archived"]{background:rgba(154,163,178,.16);color:#9aa3b2}
.admin-property-tags span[data-featured]{background:rgba(201,162,74,.2);color:#e0c47a}
.admin-property-meta h3{margin:0;font-size:.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-property-meta p{margin:4px 0 0;color:#7d766c;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-property-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.admin-icon-btn{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(244,239,230,.1);border-radius:10px;background:rgba(255,255,255,.03);color:#b7b0a4;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.admin-icon-btn:hover{border-color:rgba(201,162,74,.4);color:#e0c47a;background:rgba(201,162,74,.08)}
.admin-icon-btn.danger:hover{border-color:rgba(232,100,100,.45);color:#e88;background:rgba(232,100,100,.1)}
.admin-empty{text-align:center;padding:56px 20px;color:#7d766c}
.admin-empty svg{margin:0 auto 12px;opacity:.5}
.admin-empty strong{display:block;color:#f4efe6;margin-bottom:6px;font-size:1.05rem}
.admin-form-wrap{display:flex;flex-direction:column;gap:0;padding-bottom:88px}
.admin-form-sections{display:flex;flex-direction:column;gap:16px}
.admin-section{border:1px solid rgba(244,239,230,.1);background:rgba(16,20,26,.7);border-radius:18px;padding:18px 20px}
.admin-section legend{padding:0 6px;font-size:.82rem;color:#c9a24a;font-weight:700;letter-spacing:.04em}
.admin-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.admin-form-grid-dense{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.admin-span-2{grid-column:1/-1}
.admin-checks{display:flex;flex-wrap:wrap;gap:14px 22px;margin-top:14px}
.admin-checks label{display:flex;align-items:center;gap:8px;font-size:.9rem;cursor:pointer;color:#b7b0a4}
.admin-checks input{accent-color:#c9a24a;width:16px;height:16px}
.admin-money-hint{display:block;margin-top:4px;color:#c9a24a;font-size:.78rem}
.admin-sticky-bar{position:fixed;bottom:0;left:0;right:0;z-index:40;padding:12px 24px;background:rgba(7,9,13,.92);backdrop-filter:blur(16px);border-top:1px solid rgba(244,239,230,.1);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.admin-sticky-bar-info{color:#7d766c;font-size:.85rem}
.admin-sticky-bar-info strong{color:#f4efe6}
.admin-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-login{min-height:100vh;display:grid;place-items:center;padding:24px;background:#07090d}
.admin-login-card{width:min(100%,420px);border:1px solid rgba(244,239,230,.12);background:rgba(16,20,26,.95);border-radius:24px;padding:32px 28px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.admin-login-card .kicker{color:#c9a24a;font-size:.75rem;font-weight:600;letter-spacing:.12em;display:block;margin-bottom:8px}
.admin-login-card h1{margin:0 0 6px;font-size:1.35rem;font-weight:700}
.admin-login-card p{margin:0 0 24px;color:#7d766c;font-size:.9rem}
.admin-key-row{display:flex;gap:8px}
.admin-key-row input{flex:1;min-height:48px;padding:10px 14px;border:1px solid rgba(244,239,230,.12);border-radius:12px;background:rgba(255,255,255,.03);outline:none;font:inherit}
.admin-key-row input:focus{border-color:rgba(201,162,74,.45);box-shadow:0 0 0 3px rgba(201,162,74,.12)}
.admin-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:35;background:rgba(7,9,13,.95);backdrop-filter:blur(14px);border-top:1px solid rgba(244,239,230,.1);padding:6px 8px calc(6px + env(safe-area-inset-bottom));justify-content:space-around}
.admin-mobile-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;border:0;background:transparent;color:#7d766c;font:inherit;font-size:.68rem;cursor:pointer}
.admin-mobile-nav button.is-active{color:#e0c47a}
@keyframes admin-spin{to{transform:rotate(360deg)}}
.admin-spin{animation:admin-spin .8s linear infinite}
.admin-field label,.admin-section .field>span{display:block;color:#b7b0a4;font-size:.8rem;font-weight:600;margin-bottom:6px}
.admin-section .field input,.admin-section .field select,.admin-section .field textarea{width:100%;min-height:46px;padding:10px 12px;border:1px solid rgba(244,239,230,.1);border-radius:12px;background:rgba(255,255,255,.03);outline:none;font:inherit;color:inherit}
.admin-section .field textarea{min-height:110px;resize:vertical}
.admin-section .field input:focus,.admin-section .field select:focus,.admin-section .field textarea:focus{border-color:rgba(201,162,74,.4);box-shadow:0 0 0 3px rgba(201,162,74,.1)}
.btn-gold,.btn-ghost{min-height:44px;padding:9px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;font-size:.88rem;font-weight:600;border:1px solid transparent;cursor:pointer;transition:transform .12s,filter .12s,background .12s,border-color .12s}
.btn-gold{color:#1a1408;background:#e0c47a;box-shadow:0 6px 18px rgba(201,162,74,.2)}
.btn-gold:hover{filter:brightness(1.06)}
.btn-gold:disabled{opacity:.55;cursor:not-allowed}
.btn-ghost{color:#f4efe6;border-color:rgba(244,239,230,.12);background:rgba(255,255,255,.04)}
.btn-ghost:hover{border-color:rgba(201,162,74,.35);background:rgba(201,162,74,.08)}
@media (max-width:960px){
  .admin-sidebar{display:none}
  .admin-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .admin-property-card{grid-template-columns:72px 1fr;gap:12px}
  .admin-property-actions{grid-column:1/-1;justify-content:flex-start;padding-top:4px}
  .admin-form-grid{grid-template-columns:1fr}
  .admin-mobile-nav{display:flex}
  .admin-content{padding:16px 14px 88px}
  .admin-topbar{padding:12px 14px}
  .admin-sticky-bar{padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
}
@media (max-width:520px){
  .admin-stats-grid{grid-template-columns:1fr 1fr;gap:10px}
  .admin-stat-card strong{font-size:1.3rem}
}
`;

type PublishStatus = "draft" | "published" | "archived";
type ViewMode = "list" | "form";

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

const STORAGE_KEY = "hirmand_admin_key";
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
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    id: property.id,
    adminKey,
    title: property.title,
    transactionType: property.transactionType,
    propertyType: property.propertyType,
    neighborhood: property.neighborhood,
    address: property.address ?? "",
    areaM2: property.areaM2?.toString() ?? "",
    bedrooms: property.bedrooms?.toString() ?? "",
    bathrooms: property.bathrooms?.toString() ?? "",
    floor: property.floor?.toString() ?? "",
    totalFloors: property.totalFloors?.toString() ?? "",
    builtYear: property.builtYear?.toString() ?? "",
    parking: property.parking,
    elevator: property.elevator,
    storage: property.storage,
    price: property.price ?? "",
    deposit: property.deposit ?? "",
    rent: property.rent ?? "",
    description: property.description,
    features: property.features.join("\n"),
    images: property.images.join("\n"),
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
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | PublishStatus>("all");
  const [listQuery, setListQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const stats = useMemo(
    () => ({
      total: properties.length,
      published: properties.filter((p) => p.status === "published").length,
      draft: properties.filter((p) => p.status === "draft").length,
      archived: properties.filter((p) => p.status === "archived").length,
    }),
    [properties],
  );

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (listFilter !== "all" && p.status !== listFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.contactName.toLowerCase().includes(q)
      );
    });
  }, [properties, listFilter, listQuery]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) {
        setKeyInput(saved);
        void unlock(saved, false);
      }
    } catch {
      /* ignore */
    }
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
      try {
        sessionStorage.setItem(STORAGE_KEY, key);
      } catch {
        /* ignore */
      }
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
    setView("list");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast.message("از پنل خارج شدید.");
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!adminKey) {
      toast.error("ابتدا با کلید مدیریت وارد شوید.");
      return;
    }
    if (form.title.trim().length < 3) {
      toast.error("عنوان باید حداقل ۳ کاراکتر باشد.");
      return;
    }
    if (form.neighborhood.trim().length < 2) {
      toast.error("محله را مشخص کنید.");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error("توضیحات باید حداقل ۱۰ کاراکتر باشد.");
      return;
    }
    const { valid: images, invalid } = parseImageUrls(form.images);
    if (invalid.length) {
      toast.error(`لینک رسانه نامعتبر: ${invalid[0]}`);
      return;
    }
    setLoading(true);
    try {
      const result = await saveProperty({
        data: {
          adminKey: form.adminKey || adminKey,
          id: form.id,
          title: form.title.trim(),
          transactionType: form.transactionType,
          propertyType: form.propertyType,
          neighborhood: form.neighborhood.trim(),
          address: form.address.trim(),
          areaM2: numberOrNull(form.areaM2),
          bedrooms: numberOrNull(form.bedrooms),
          bathrooms: numberOrNull(form.bathrooms),
          floor: numberOrNull(form.floor),
          totalFloors: numberOrNull(form.totalFloors),
          builtYear: numberOrNull(form.builtYear),
          parking: form.parking,
          elevator: form.elevator,
          storage: form.storage,
          price: toEnglishDigits(form.price).replace(/[^\d]/g, ""),
          deposit: toEnglishDigits(form.deposit).replace(/[^\d]/g, ""),
          rent: toEnglishDigits(form.rent).replace(/[^\d]/g, ""),
          description: form.description.trim(),
          features: splitLines(form.features),
          images,
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          status: form.status,
          featured: form.featured,
        },
      });
      setProperties((prev) =>
        prev.some((item) => item.id === result.id)
          ? prev.map((item) => (item.id === result.id ? result : item))
          : [result, ...prev],
      );
      setForm(propertyToForm(result, adminKey));
      toast.success(form.status === "published" ? "فایل منتشر شد." : "فایل ذخیره شد.");
      setView("list");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره فایل انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm(emptyForm(adminKey));
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function edit(property: Property) {
    setForm(propertyToForm(property, adminKey));
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicate(property: Property) {
    const base = propertyToForm(property, adminKey);
    setForm({
      ...base,
      id: undefined,
      title: `${property.title} (کپی)`,
      status: "draft",
      featured: false,
    });
    setView("form");
    toast.message("کپی آماده است — بعد از ویرایش ذخیره کنید.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(property: Property) {
    if (!adminKey) return;
    if (!window.confirm(`حذف «${property.title}»؟`)) return;
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
          adminKey,
          id: property.id,
          title: property.title,
          transactionType: property.transactionType,
          propertyType: property.propertyType,
          neighborhood: property.neighborhood,
          address: property.address ?? "",
          areaM2: property.areaM2,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          floor: property.floor,
          totalFloors: property.totalFloors,
          builtYear: property.builtYear,
          parking: property.parking,
          elevator: property.elevator,
          storage: property.storage,
          price: property.price ?? "",
          deposit: property.deposit ?? "",
          rent: property.rent ?? "",
          description: property.description,
          features: property.features,
          images: property.images,
          contactName: property.contactName,
          contactPhone: property.contactPhone,
          status,
          featured: property.featured,
        },
      });
      setProperties((prev) => prev.map((item) => (item.id === result.id ? result : item)));
      toast.success(`وضعیت: ${STATUS_LABEL[status]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  const isRentLike = form.transactionType === "rent" || form.transactionType === "mortgage";
  const currentSlug = form.id ? properties.find((p) => p.id === form.id)?.slug : undefined;

  // ── Login screen ──────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="admin-login">
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
        <div className="admin-login-card">
          <span className="kicker">پنل داخلی هیرمند</span>
          <h1>ورود به مدیریت فایل‌ها</h1>
          <p>کلید سرور (HIRMAND_ADMIN_KEY) را وارد کنید.</p>
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
              autoFocus
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
            <Link to="/" className="btn-ghost" style={{ fontSize: ".85rem" }}>
              بازگشت به سایت
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main admin shell ──────────────────────────────────────────
  return (
    <div className="admin-app">
      <Toaster position="top-center" dir="rtl" richColors closeButton />
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Building2 size={22} color="#c9a24a" />
          <div>
            <strong>هیرمند</strong>
            <small>پنل مدیریت</small>
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
            افزودن فایل جدید
          </button>
          {form.id ? (
            <button
              type="button"
              className={`admin-nav-btn${view === "form" && form.id ? " is-active" : ""}`}
              onClick={() => setView("form")}
            >
              <FileEdit size={18} />
              در حال ویرایش
            </button>
          ) : null}
        </nav>
        <div className="admin-sidebar-foot">
          <button type="button" className="admin-nav-btn" onClick={() => void refresh()} disabled={loadingList}>
            <RefreshCw size={18} className={loadingList ? "admin-spin" : undefined} />
            به‌روزرسانی
          </button>
          <Link to="/" className="admin-nav-btn">
            <Home size={18} />
            مشاهده سایت
          </Link>
          <button type="button" className="admin-nav-btn" onClick={logout}>
            <LogOut size={18} />
            خروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>
              {view === "list"
                ? "فهرست فایل‌های ملکی"
                : form.id
                  ? "ویرایش فایل"
                  : "ثبت فایل جدید"}
            </h1>
            <p>
              {stats.published.toLocaleString("fa-IR")} منتشر ·{" "}
              {stats.draft.toLocaleString("fa-IR")} پیش‌نویس ·{" "}
              {stats.archived.toLocaleString("fa-IR")} بایگانی
            </p>
          </div>
          <div className="admin-topbar-actions">
            {view === "list" ? (
              <button type="button" className="btn-gold" onClick={startNew}>
                <Plus size={16} /> فایل جدید
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setView("list")}>
                <X size={16} /> بستن فرم
              </button>
            )}
          </div>
        </header>

        <div className="admin-content">
          {/* Stats */}
          <div className="admin-stats-grid">
            {(
              [
                { key: "all" as const, label: "همه", value: stats.total, tone: "gold" },
                { key: "published" as const, label: "منتشرشده", value: stats.published, tone: "green" },
                { key: "draft" as const, label: "پیش‌نویس", value: stats.draft, tone: "amber" },
                { key: "archived" as const, label: "بایگانی", value: stats.archived, tone: "muted" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`admin-stat-card${listFilter === item.key ? " is-active" : ""}`}
                data-tone={item.tone}
                onClick={() => {
                  setListFilter(item.key);
                  setView("list");
                }}
              >
                <span>{item.label}</span>
                <strong>{item.value.toLocaleString("fa-IR")}</strong>
              </button>
            ))}
          </div>

          {/* List view */}
          {view === "list" ? (
            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <span className="kicker">فایل‌ها</span>
                  <h2>{filtered.length.toLocaleString("fa-IR")} مورد</h2>
                </div>
                <div className="admin-list-toolbar">
                  <div className="admin-search">
                    <Search size={16} />
                    <input
                      value={listQuery}
                      onChange={(e) => setListQuery(e.target.value)}
                      placeholder="جستجو عنوان، محله، مشاور..."
                    />
                  </div>
                </div>
              </div>

              {loadingList ? (
                <div className="admin-empty">
                  <RefreshCw size={28} className="admin-spin" />
                  <strong>در حال بارگذاری...</strong>
                </div>
              ) : filtered.length === 0 ? (
                <div className="admin-empty">
                  <FileEdit size={32} />
                  <strong>فایلی یافت نشد</strong>
                  <p style={{ marginTop: 4 }}>
                    {listQuery || listFilter !== "all"
                      ? "فیلتر یا جستجو را تغییر دهید."
                      : "اولین فایل ملکی را ثبت کنید."}
                  </p>
                  {!listQuery && listFilter === "all" ? (
                    <button type="button" className="btn-gold" style={{ marginTop: 16 }} onClick={startNew}>
                      <Plus size={16} /> افزودن فایل
                    </button>
                  ) : null}
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
                          <span data-status={property.status}>{STATUS_LABEL[property.status]}</span>
                          {property.featured ? <span data-featured>ویژه</span> : null}
                        </div>
                        <h3>{property.title}</h3>
                        <p>
                          {property.neighborhood}
                          {property.areaM2 ? ` · ${property.areaM2} م²` : ""}
                          {" · "}
                          {property.contactName}
                          {property.price
                            ? ` · ${moneyLabel(property.price)}`
                            : property.rent
                              ? ` · اجاره ${moneyLabel(property.rent)}`
                              : ""}
                        </p>
                      </div>
                      <div className="admin-property-actions">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          title="ویرایش"
                          onClick={() => edit(property)}
                        >
                          <FileEdit size={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          title="کپی"
                          onClick={() => duplicate(property)}
                        >
                          <Copy size={15} />
                        </button>
                        {property.status !== "published" ? (
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="انتشار"
                            onClick={() => void quickStatus(property, "published")}
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="بایگانی"
                            onClick={() => void quickStatus(property, "archived")}
                          >
                            <Archive size={15} />
                          </button>
                        )}
                        <Link
                          to="/properties/$slug"
                          params={{ slug: property.slug }}
                          className="admin-icon-btn"
                          target="_blank"
                          title="مشاهده"
                        >
                          <ExternalLink size={15} />
                        </Link>
                        <button
                          type="button"
                          className="admin-icon-btn danger"
                          title="حذف"
                          onClick={() => void remove(property)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Form view */}
          {view === "form" ? (
            <form className="admin-form-wrap" onSubmit={(e) => void save(e)}>
              <div className="admin-form-sections">
                {/* Main info */}
                <fieldset className="admin-section">
                  <legend>اطلاعات اصلی</legend>
                  <div className="admin-form-grid">
                    <label className="field admin-span-2">
                      <span>عنوان *</span>
                      <input
                        value={form.title}
                        onChange={(e) => update("title", e.target.value)}
                        required
                        maxLength={180}
                        placeholder="مثال: آپارتمان ۱۲۰ متری سه خواب در جلفا"
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
                        {TX_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
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
                      <span>محله *</span>
                      <input
                        list="admin-neighborhoods"
                        value={form.neighborhood}
                        onChange={(e) => update("neighborhood", e.target.value)}
                        required
                        placeholder="جلفا، عباس‌آباد، ..."
                      />
                      <datalist id="admin-neighborhoods">
                        {NEIGHBORHOOD_NAMES.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field">
                      <span>آدرس</span>
                      <input
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        placeholder="خیابان، کوچه، پلاک..."
                      />
                    </label>
                    <label className="field admin-span-2">
                      <span>توضیحات *</span>
                      <textarea
                        rows={5}
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                        required
                        maxLength={5000}
                        placeholder="توضیحات کامل ملک، موقعیت، امکانات و شرایط..."
                      />
                    </label>
                  </div>
                </fieldset>

                {/* Specs */}
                <fieldset className="admin-section">
                  <legend>مشخصات فنی</legend>
                  <div className="admin-form-grid admin-form-grid-dense">
                    <label className="field">
                      <span>متراژ (م²)</span>
                      <input
                        inputMode="numeric"
                        value={form.areaM2}
                        onChange={(e) => update("areaM2", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>خواب</span>
                      <input
                        inputMode="numeric"
                        value={form.bedrooms}
                        onChange={(e) => update("bedrooms", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>سرویس</span>
                      <input
                        inputMode="numeric"
                        value={form.bathrooms}
                        onChange={(e) => update("bathrooms", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>طبقه</span>
                      <input
                        inputMode="numeric"
                        value={form.floor}
                        onChange={(e) => update("floor", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>کل طبقات</span>
                      <input
                        inputMode="numeric"
                        value={form.totalFloors}
                        onChange={(e) => update("totalFloors", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>سال ساخت</span>
                      <input
                        inputMode="numeric"
                        value={form.builtYear}
                        onChange={(e) => update("builtYear", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="admin-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.parking}
                        onChange={(e) => update("parking", e.target.checked)}
                      />{" "}
                      پارکینگ
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.elevator}
                        onChange={(e) => update("elevator", e.target.checked)}
                      />{" "}
                      آسانسور
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.storage}
                        onChange={(e) => update("storage", e.target.checked)}
                      />{" "}
                      انباری
                    </label>
                  </div>
                </fieldset>

                {/* Pricing */}
                <fieldset className="admin-section">
                  <legend>قیمت و شرایط</legend>
                  <div className="admin-form-grid">
                    {!isRentLike ? (
                      <label className="field">
                        <span>قیمت (تومان)</span>
                        <input
                          inputMode="numeric"
                          value={form.price}
                          onChange={(e) => update("price", e.target.value)}
                          placeholder="مثلاً 8500000000"
                        />
                        {form.price ? (
                          <span className="admin-money-hint">{moneyLabel(toEnglishDigits(form.price).replace(/[^\d]/g, "") || null)}</span>
                        ) : null}
                      </label>
                    ) : (
                      <>
                        <label className="field">
                          <span>رهن / ودیعه (تومان)</span>
                          <input
                            inputMode="numeric"
                            value={form.deposit}
                            onChange={(e) => update("deposit", e.target.value)}
                          />
                          {form.deposit ? (
                            <span className="admin-money-hint">
                              {moneyLabel(toEnglishDigits(form.deposit).replace(/[^\d]/g, "") || null)}
                            </span>
                          ) : null}
                        </label>
                        <label className="field">
                          <span>اجاره ماهانه (تومان)</span>
                          <input
                            inputMode="numeric"
                            value={form.rent}
                            onChange={(e) => update("rent", e.target.value)}
                          />
                          {form.rent ? (
                            <span className="admin-money-hint">
                              {moneyLabel(toEnglishDigits(form.rent).replace(/[^\d]/g, "") || null)}
                            </span>
                          ) : null}
                        </label>
                      </>
                    )}
                    <label className="field admin-span-2">
                      <span>ویژگی‌ها (هر خط یک مورد)</span>
                      <textarea
                        rows={3}
                        value={form.features}
                        onChange={(e) => update("features", e.target.value)}
                        placeholder={"نورگیر\nبازسازی‌شده\nتراس"}
                      />
                    </label>
                  </div>
                </fieldset>

                {/* Media */}
                <fieldset className="admin-section">
                  <legend>رسانه (تصویر و ویدیو)</legend>
                  <AdminMediaField
                    adminKey={adminKey}
                    value={form.images}
                    onChange={(next) => update("images", next)}
                  />
                </fieldset>

                {/* Consultant & status */}
                <fieldset className="admin-section">
                  <legend>مشاور و وضعیت انتشار</legend>
                  <AdminConsultantPicker
                    contactName={form.contactName}
                    contactPhone={form.contactPhone}
                    onSelect={(member) => {
                      update("contactName", member.name);
                      update("contactPhone", member.phone);
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
                    <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 22 }}>
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

              {/* Sticky action bar */}
              <div className="admin-sticky-bar">
                <div className="admin-sticky-bar-info">
                  {form.id ? (
                    <>
                      در حال ویرایش: <strong>{form.title || "بدون عنوان"}</strong>
                      {currentSlug ? (
                        <>
                          {" · "}
                          <Link
                            to="/properties/$slug"
                            params={{ slug: currentSlug }}
                            target="_blank"
                            style={{ color: "#c9a24a" }}
                          >
                            مشاهده صفحه
                          </Link>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span>فایل جدید</span>
                  )}
                </div>
                <div className="admin-sticky-actions">
                  <button type="button" className="btn-ghost" onClick={() => setView("list")}>
                    انصراف
                  </button>
                  <button type="submit" className="btn-gold" disabled={loading}>
                    {loading ? (
                      <RefreshCw size={16} className="admin-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {form.status === "published" ? "ذخیره و انتشار" : "ذخیره"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="admin-mobile-nav">
        <button
          type="button"
          className={view === "list" ? "is-active" : ""}
          onClick={() => setView("list")}
        >
          <LayoutDashboard size={20} />
          فهرست
        </button>
        <button type="button" className={view === "form" && !form.id ? "is-active" : ""} onClick={startNew}>
          <Plus size={20} />
          جدید
        </button>
        <button type="button" onClick={() => void refresh()} disabled={loadingList}>
          <RefreshCw size={20} className={loadingList ? "admin-spin" : undefined} />
          بروزرسانی
        </button>
        <Link to="/">
          <Home size={20} />
          سایت
        </Link>
      </nav>
    </div>
  );
}
