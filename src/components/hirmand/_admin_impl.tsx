import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
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
  Filter,
  ArrowUpDown,
  Globe2,
  Download,
  CheckSquare,
} from "lucide-react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SITE, TEAM } from "@/lib/site";
import { propertyPath } from "@/lib/property-path";
import type { Property, PropertyType, PropertyTransaction } from "@/lib/properties";
import {
  bulkAssignPropertyConsultant,
  bulkDeleteProperties,
  bulkSetPropertyFeatured,
  bulkUpdatePropertyStatus,
  countAdminProperties,
  countFilteredAdminProperties,
  deleteProperty,
  listAdminProperties,
  listPropertyChangeHistory,
  saveProperty,
} from "@/lib/properties";
import { toast, Toaster } from "sonner";
import { AdminMediaField } from "@/components/hirmand/admin-media-field";
import { AdminPricingPanel } from "@/components/hirmand/admin-pricing-panel";
import { AdminConsultantPicker } from "@/components/hirmand/admin-consultant-picker";
import { AdminMusicManager } from "@/components/hirmand/admin-music-manager";
import { AdminLeadManager } from "@/components/hirmand/admin-lead-manager";
import { AdminDashboard } from "@/components/hirmand/admin-dashboard";
import { ADMIN_CSS } from "@/components/hirmand/admin-shell-css";
import { AdminListingAssistant } from "@/components/hirmand/admin-listing-assistant";
import { AdminPartnerManager } from "@/components/hirmand/admin-partner-manager";
import { AdminDivarFiles } from "@/components/hirmand/admin-divar-files";

type PublishStatus = "draft" | "published" | "archived";
type ViewMode = "dashboard" | "list" | "form" | "music" | "leads" | "partners" | "divar";

type FormState = {
  id?: string;
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
  featuredUntil: string;
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

function emptyForm(): FormState {
  return {

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
    featuredUntil: "",
  };
}

function toEnglishDigits(raw: string) {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
function numberOrNull(raw: string, allowNegative = false) {
  const digits = toEnglishDigits(raw).replace(/[^\d-]/g, "");
  if (!digits.trim()) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return allowNegative || value >= 0 ? value : null;
}
function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (item: number) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function propertyQuality(property: Property) {
  let score = 0;
  const title = property.title.trim();
  const description = property.description.trim();
  const contact = property.contactName.trim() && property.contactPhone.trim();
  const hasPrice =
    property.transactionType === "sell" || property.transactionType === "buy"
      ? Boolean(property.price)
      : property.transactionType === "rent"
        ? Boolean(property.deposit || property.rent)
        : Boolean(property.deposit);

  if (title.length >= 12) score += 20;
  if (description.length >= 120) score += 25;
  if (property.images.length >= 3) score += 20;
  if (property.address?.trim()) score += 15;
  if (contact) score += 10;
  if (hasPrice) score += 10;

  return {
    score,
    complete: score >= 80,
    label: score >= 80 ? "کامل" : score >= 60 ? "قابل انتشار" : "نیازمند تکمیل",
  };
}

function propertyToForm(property: Property): FormState {
  return {
    id: property.id,
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
    featuredUntil: toDateTimeLocal(property.featuredUntil),
  };
}

export function AdminPropertiesPage() {
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyOffset, setPropertyOffset] = useState(0);
  const [propertyHasMore, setPropertyHasMore] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [serverStats, setServerStats] = useState<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    featured: number;
  } | null>(null);
  const propertyRequestId = useRef(0);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [listFilter, setListFilter] = useState<"all" | PublishStatus | "featured">("all");
  const [query, setQuery] = useState("");
  const [listTransaction, setListTransaction] = useState<"all" | PropertyTransaction>("all");
  const [listType, setListType] = useState<"all" | PropertyType>("all");
  const [listNeighborhood, setListNeighborhood] = useState("");
  const [listSort, setListSort] = useState<"newest" | "title" | "price_desc">("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [changeHistory, setChangeHistory] = useState<Array<{
    id: number;
    action: "created" | "updated" | "deleted";
    changedAt: string;
    beforeTitle: string | null;
    beforeStatus: "draft" | "published" | "archived" | null;
    beforeFeatured: boolean | null;
    beforePrice: string | null;
    beforeDeposit: string | null;
    beforeRent: string | null;
    beforeContactName: string | null;
    beforeContactPhone: string | null;
    afterTitle: string | null;
    afterStatus: "draft" | "published" | "archived" | null;
    afterFeatured: boolean | null;
    afterPrice: string | null;
    afterDeposit: string | null;
    afterRent: string | null;
    afterContactName: string | null;
    afterContactPhone: string | null;
  }>>([]);
  const [form, setForm] = useState<FormState>(emptyForm());

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!unlocked || !form.id) {
      setChangeHistory([]);
      return;
    }

    let cancelled = false;
    void listPropertyChangeHistory({ data: { id: form.id, limit: 10 } })
      .then((items) => {
        if (!cancelled) setChangeHistory(items);
      })
      .catch(() => {
        if (!cancelled) setChangeHistory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [unlocked, form.id]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "login" }),
        });
        const data = (await response.json().catch(() => null)) as
          | { authenticated?: boolean }
          | null;

        if (!data?.authenticated || cancelled) return;

        const [rows, totals, filteredCount] = await Promise.all([
          listAdminProperties({ data: { limit: 50, offset: 0 } }),
          countAdminProperties({ data: {} }),
          countFilteredAdminProperties({ data: { limit: 50, offset: 0 } }),
        ]);

        if (cancelled) return;
        setProperties(rows);
        setPropertyOffset(rows.length);
        setFilteredTotal(filteredCount);
        setPropertyHasMore(rows.length < filteredCount);
        setServerStats(totals);
        setUnlocked(true);
      } catch {
        // No valid session: show the login screen.
      } finally {
        if (!cancelled) setSessionChecking(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function currentListFilters(offset = 0, limit = 50) {
    return {
      limit,
      offset,
      status:
        listFilter !== "all" && listFilter !== "featured"
          ? listFilter
          : undefined,
      transactionType: listTransaction !== "all" ? listTransaction : undefined,
      propertyType: listType !== "all" ? listType : undefined,
      neighborhood: listNeighborhood || undefined,
      featuredOnly: listFilter === "featured",
      search: query.trim() || undefined,
      sort: listSort,
    } as const;
  }

  async function refresh() {
    if (!unlocked) return;
    const requestId = ++propertyRequestId.current;
    setLoadingList(true);
    try {
      const filterData = currentListFilters(0, 50);
      const [rows, totals, filteredCount] = await Promise.all([
        listAdminProperties({ data: filterData }),
        countAdminProperties({ data: {} }),
        countFilteredAdminProperties({ data: filterData }),
      ]);
      if (requestId !== propertyRequestId.current) return;
      setProperties(rows);
      setPropertyOffset(rows.length);
      setFilteredTotal(filteredCount);
      setPropertyHasMore(rows.length < filteredCount);
      setServerStats(totals);
    } catch (error) {
      if (requestId !== propertyRequestId.current) return;
      toast.error(error instanceof Error ? error.message : "بارگذاری فایل‌ها انجام نشد.");
      throw error;
    } finally {
      if (requestId === propertyRequestId.current) setLoadingList(false);
    }
  }

  async function unlock(key = keyInput.trim(), showToast = true) {
    if (!key) {
      toast.error("کلید مدیریت را وارد کنید.");
      return;
    }

    setLoadingList(true);
    try {
      const sessionResponse = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "login", adminKey: key }),
      });
      const sessionData = (await sessionResponse.json().catch(() => null)) as
        | { authenticated?: boolean; statusMessage?: string; message?: string }
        | null;

      if (!sessionResponse.ok || !sessionData?.authenticated) {
        throw new Error(
          sessionData?.statusMessage ||
            sessionData?.message ||
            "ورود به پنل مدیریت انجام نشد.",
        );
      }

      const filterData = currentListFilters(0, 50);
      const [rows, totals, filteredCount] = await Promise.all([
        listAdminProperties({ data: filterData }),
        countAdminProperties({ data: {} }),
        countFilteredAdminProperties({ data: filterData }),
      ]);

      setKeyInput("");
      setProperties(rows);
      setPropertyOffset(rows.length);
      setFilteredTotal(filteredCount);
      setPropertyHasMore(rows.length < filteredCount);
      setServerStats(totals);
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
    void fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {
      // Local state is still cleared even when the logout request fails.
    });

    setUnlocked(false);
    setKeyInput("");
    setProperties([]);
    setPropertyOffset(0);
    setPropertyHasMore(false);
    setFilteredTotal(0);
    setServerStats(null);
    setForm(emptyForm());
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((item) => item.id);
    setSelectedIds((current) =>
      visibleIds.length > 0 && visibleIds.every((id) => current.includes(id))
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  async function exportProperties() {
    try {
      const response = await fetch("/api/admin/properties-export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(body?.statusMessage || body?.message || "خروجی فایل‌ها آماده نشد.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "hirmand-properties.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("خروجی کامل فایل‌ها دانلود شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خروجی گرفتن انجام نشد.");
    }
  }

  async function bulkSetStatus(status: PublishStatus) {
    const ids = Array.from(new Set(selectedIds));
    if (!ids.length || bulkBusy) return;
    if (status === "archived" && !confirm("آرشیو " + ids.length.toLocaleString("fa-IR") + " فایل انتخاب‌شده؟")) return;

    setBulkBusy(true);
    try {
      const result = await bulkUpdatePropertyStatus({ data: { ids, status } });
      setSelectedIds([]);
      await refresh();
      toast.success((result.updated || ids.length).toLocaleString("fa-IR") + " فایل به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "عملیات گروهی کامل نشد.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkSetFeatured(featured: boolean) {
    const ids = Array.from(new Set(selectedIds));
    if (!ids.length || bulkBusy) return;

    setBulkBusy(true);
    try {
      const result = await bulkSetPropertyFeatured({ data: { ids, featured } });
      setSelectedIds([]);
      await refresh();
      toast.success((result.updated || ids.length).toLocaleString("fa-IR") + (featured ? " فایل ویژه شد." : " فایل از حالت ویژه خارج شد."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت ویژه انجام نشد.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkAssignConsultant(member: { name: string; phone: string }) {
    const ids = Array.from(new Set(selectedIds));
    if (!ids.length || bulkBusy) return;

    setBulkBusy(true);
    try {
      const result = await bulkAssignPropertyConsultant({
        data: {
          ids,
          contactName: member.name,
          contactPhone: member.phone,
        },
      });
      setSelectedIds([]);
      await refresh();
      toast.success((result.updated || ids.length).toLocaleString("fa-IR") + " فایل به «" + member.name + "» واگذار شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تخصیص مشاور انجام نشد.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    const ids = Array.from(new Set(selectedIds));
    if (!ids.length || bulkBusy) return;
    if (!confirm("حذف دائمی " + ids.length.toLocaleString("fa-IR") + " فایل انتخاب‌شده؟ این عمل قابل بازگشت نیست.")) return;

    setBulkBusy(true);
    try {
      const result = await bulkDeleteProperties({ data: { ids } });
      setSelectedIds([]);
      await refresh();
      toast.success((result.deleted || ids.length).toLocaleString("fa-IR") + " فایل حذف شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف گروهی کامل نشد.");
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;

    const timer = window.setTimeout(() => {
      const requestId = ++propertyRequestId.current;
      setSelectedIds([]);
      setLoadingList(true);

      const filterData = {
        limit: 50,
        offset: 0,
        status:
          listFilter !== "all" && listFilter !== "featured"
            ? listFilter
            : undefined,
        transactionType: listTransaction !== "all" ? listTransaction : undefined,
        propertyType: listType !== "all" ? listType : undefined,
        neighborhood: listNeighborhood || undefined,
        featuredOnly: listFilter === "featured",
        search: query.trim() || undefined,
        sort: listSort,
      };
      void Promise.all([
        listAdminProperties({ data: filterData }),
        countFilteredAdminProperties({ data: filterData }),
      ])
        .then(([rows, filteredCount]) => {
          if (requestId !== propertyRequestId.current) return;
          setProperties(rows);
          setPropertyOffset(rows.length);
          setFilteredTotal(filteredCount);
          setPropertyHasMore(rows.length < filteredCount);
        })
        .catch((error) => {
          if (requestId !== propertyRequestId.current) return;
          toast.error(error instanceof Error ? error.message : "اعمال فیلترها انجام نشد.");
        })
        .finally(() => {
          if (requestId === propertyRequestId.current) setLoadingList(false);
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [unlocked, query, listFilter, listTransaction, listType, listNeighborhood, listSort]);

  const filtered = properties;

  const stats = useMemo(() => {
    const published = properties.filter((p) => p.status === "published").length;
    const draft = properties.filter((p) => p.status === "draft").length;
    const archived = properties.filter((p) => p.status === "archived").length;
    const featured = properties.filter((p) => p.featured).length;

    return {
      total: serverStats?.total ?? filteredTotal,
      published: serverStats?.published ?? published,
      draft: serverStats?.draft ?? draft,
      archived: serverStats?.archived ?? archived,
      featured: serverStats?.featured ?? featured,
    };
  }, [properties, serverStats, filteredTotal]);



  async function loadMoreProperties() {
    if (!unlocked || loadingList || !propertyHasMore) return;

    const requestId = propertyRequestId.current;
    const requestedOffset = propertyOffset;
    setLoadingList(true);
    try {
      const rows = await listAdminProperties({
        data: currentListFilters(requestedOffset, 50),
      });

      // A filter/search change can start another request while this page is
      // in flight. Never append the old result to the new list.
      if (propertyRequestId.current !== requestId) return;

      setProperties((current) => [...current, ...rows]);
      setPropertyOffset((current) => current + rows.length);
      setPropertyHasMore(requestedOffset + rows.length < filteredTotal);
    } catch (error) {
      if (propertyRequestId.current !== requestId) return;
      toast.error(error instanceof Error ? error.message : "بارگذاری فایل‌های بیشتر انجام نشد.");
    } finally {
      if (propertyRequestId.current === requestId) setLoadingList(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!unlocked) {
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
    if (form.description.trim().length < 10) {
      toast.error("توضیحات فایل را کامل‌تر بنویسید.");
      return;
    }
    const price = numberOrNull(form.price);
    const deposit = numberOrNull(form.deposit);
    const rent = numberOrNull(form.rent);
    if (form.transactionType === "sell" && price == null) {
      toast.error("برای فایل فروش، قیمت فروش را وارد کنید.");
      return;
    }
    if (form.transactionType === "rent" && deposit == null && rent == null) {
      toast.error("برای فایل اجاره حداقل یکی از رهن یا اجاره را وارد کنید.");
      return;
    }
    if (form.transactionType === "mortgage" && deposit == null) {
      toast.error("برای فایل رهن، مبلغ رهن را وارد کنید.");
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
          id: form.id,
          title: form.title.trim(),
          transactionType: form.transactionType,
          propertyType: form.propertyType,
          neighborhood: form.neighborhood.trim(),
          address: form.address.trim() || undefined,
          areaM2: numberOrNull(form.areaM2),
          bedrooms: numberOrNull(form.bedrooms),
          bathrooms: numberOrNull(form.bathrooms),
          floor: numberOrNull(form.floor, true),
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
          featuredUntil: form.featuredUntil
            ? (() => {
                const date = new Date(form.featuredUntil);
                if (!Number.isFinite(date.getTime())) throw new Error("تاریخ پایان ویژه نامعتبر است.");
                return date.toISOString();
              })()
            : null,
        },
      });
      toast.success(form.id ? "فایل به‌روزرسانی شد." : "فایل جدید ذخیره شد.");
      setForm(propertyToForm(result));
      const history = await listPropertyChangeHistory({ data: { id: result.id, limit: 10 } }).catch(() => []);
      setChangeHistory(history);
      await refresh();
      setView("list");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setForm(emptyForm());
    setChangeHistory([]);
    setView("form");
  }

  function editProperty(property: Property) {
    setForm(propertyToForm(property));
    setView("form");
  }

  function duplicateProperty(property: Property) {
    const base = propertyToForm(property);
    setForm({
      ...base,
      id: undefined,
      title: `${base.title} (کپی)`,
      status: "draft",
      featured: false,
      featuredUntil: "",
    });
    setView("form");
  }

  async function quickSetStatus(property: Property, status: PublishStatus) {
    if (status === "archived" && !confirm(`بایگانی «${property.title}»؟`)) return;
    try {
      setSaving(true);
      const base = propertyToForm(property);
      const result = await saveProperty({
        data: {
          id: base.id,
          title: base.title,
          transactionType: base.transactionType,
          propertyType: base.propertyType,
          neighborhood: base.neighborhood,
          address: base.address || undefined,
          areaM2: numberOrNull(base.areaM2),
          bedrooms: numberOrNull(base.bedrooms),
          bathrooms: numberOrNull(base.bathrooms),
          floor: numberOrNull(base.floor, true),
          totalFloors: numberOrNull(base.totalFloors),
          builtYear: numberOrNull(base.builtYear),
          parking: base.parking,
          elevator: base.elevator,
          storage: base.storage,
          price: numberOrNull(base.price),
          deposit: numberOrNull(base.deposit),
          rent: numberOrNull(base.rent),
          description: base.description,
          features: splitLines(base.features),
          images: parseImageUrls(base.images).valid,
          contactName: base.contactName,
          contactPhone: base.contactPhone,
          status,
          featured: base.featured,
          featuredUntil: base.featuredUntil
            ? (() => {
                const date = new Date(base.featuredUntil);
                if (!Number.isFinite(date.getTime())) throw new Error("تاریخ پایان ویژه نامعتبر است.");
                return date.toISOString();
              })()
            : null,
        },
      });
      setProperties((current) => current.map((item) => item.id === result.id ? result : item));
      toast.success(status === "published" ? "فایل فوراً منتشر شد." : "فایل بایگانی شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProperty(property: Property) {
    if (!confirm(`حذف «${property.title}»؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await deleteProperty({ data: { id: property.id } });
      toast.success("فایل حذف شد.");
      if (form.id === property.id) setForm(emptyForm());
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف انجام نشد.");
    }
  }

  if (sessionChecking) {
    return (
      <div className="admin-login">
        <Toaster position="top-center" dir="rtl" richColors closeButton />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
        <div className="admin-login-card">
          <span className="kicker">پنل داخلی هیرمند</span>
          <h1>در حال بررسی نشست</h1>
          <p>اعتبار نشست مدیریت بررسی می‌شود…</p>
          <RefreshCw size={24} className="admin-spin" />
        </div>
      </div>
    );
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
          <Building2 size={22} color="#f7f5ef" />
          <div>
            <strong>هیرمند</strong>
            <small>پنل مدیریت فایل‌ها</small>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={`admin-nav-btn${view === "dashboard" ? " is-active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            <BarChart3 size={18} />
            داشبورد
          </button>
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
          <button type="button" className={"admin-nav-btn" + (view === "partners" ? " is-active" : "")} onClick={() => setView("partners")}>
            <UsersRound size={18} />
            همکاران و کد رهگیری
          </button>
          <button type="button" className={"admin-nav-btn" + (view === "divar" ? " is-active" : "")} onClick={() => setView("divar")}>
            <Globe2 size={18} />
            فایل‌های دیوار
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
              {view === "dashboard"
                ? "داشبورد مدیریت"
                : view === "list"
                  ? "فهرست فایل‌ها"
                  : view === "music"
                    ? "موسیقی سایت"
                    : view === "leads"
                      ? "درخواست‌های مشتری"
                      : view === "partners"
                        ? "باشگاه همکاران و کد رهگیری"
                        : view === "divar"
                          ? "فایل‌های دیوار"
                          : form.id
                        ? "ویرایش فایل"
                        : "افزودن فایل جدید"}            </h1>
            <p>
              {view === "dashboard"
                ? "نمای کلی فایل‌ها، ورودی مشتری و وضعیت پیگیری"
                : view === "list"
                  ? `${stats.total.toLocaleString("fa-IR")} فایل در سیستم`
                  : view === "leads"
                    ? "مدیریت Leadها و پیگیری مشتریان"
                    : view === "divar"
                      ? "دریافت، فیلتر و ورود فایل‌های شخصی از دیوار"
                      : form.contactName
                    ? `مشاور مسئول: ${form.contactName}`
                    : "مشاور مسئول را انتخاب کنید"}            </p>
          </div>
          <div className="admin-topbar-actions">
            {view === "dashboard" || view === "list" ? (
              <button type="button" className="btn-gold" onClick={startNew}>
                <Plus size={16} />
                فایل جدید
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setView(view === "form" ? "list" : "dashboard")}>
                <X size={16} />
                بستن
              </button>
            )}
          </div>
        </header>

        <div className="admin-content">
          {view === "dashboard" ? (
            <AdminDashboard
              onOpenProperties={() => setView("list")}
              onOpenLeads={() => setView("leads")}
            />
          ) : null}

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
                    <h2>{filteredTotal.toLocaleString("fa-IR")} مورد مطابق فیلتر</h2>
                  </div>
                  <div className="admin-list-toolbar" style={{ width: "100%" }}>
                    <label className="admin-search" style={{ flex: 1 }}>
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="جستجو عنوان، محله، مشاور…"
                      />
                    </label>
                    <button type="button" className="btn-ghost" onClick={() => {
                      setQuery("");
                      setListTransaction("all");
                      setListType("all");
                      setListNeighborhood("");
                      setListSort("newest");
                    }}>
                      <Filter size={15} /> پاک‌سازی فیلتر
                    </button>
                  </div>
                  <div className="admin-filter-row">
                    <select value={listTransaction} onChange={(e) => setListTransaction(e.target.value as typeof listTransaction)} aria-label="فیلتر معامله">
                      <option value="all">همه معاملات</option>
                      <option value="sell">فروش</option>
                      <option value="rent">اجاره</option>
                      <option value="mortgage">رهن</option>
                      <option value="buy">درخواست خرید</option>
                    </select>
                    <select value={listType} onChange={(e) => setListType(e.target.value as typeof listType)} aria-label="فیلتر نوع ملک">
                      <option value="all">همه انواع ملک</option>
                      {PROPERTY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                    <select value={listNeighborhood} onChange={(e) => setListNeighborhood(e.target.value)} aria-label="فیلتر محله">
                      <option value="">همه محله‌ها</option>
                      {NEIGHBORHOOD_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <select value={listSort} onChange={(e) => setListSort(e.target.value as typeof listSort)} aria-label="مرتب‌سازی">
                      <option value="newest">آخرین تغییر</option>
                      <option value="title">عنوان الفبایی</option>
                      <option value="price_desc">بیشترین قیمت</option>
                    </select>
                    <div className="admin-results-meta"><ArrowUpDown size={14} /> {filtered.length.toLocaleString("fa-IR")} مورد نمایش‌داده‌شده</div>
                  </div>
                  <div className="admin-list-toolbar" style={{ marginTop: 10, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="btn-ghost" onClick={toggleSelectAllVisible}>
                        <CheckSquare size={15} />
                        {filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id)) ? "لغو انتخاب نمایش‌داده‌شده" : "انتخاب نمایش‌داده‌شده"}
                      </button>
                      {selectedIds.length > 0 ? (
                        <>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => void bulkSetStatus("published")}>انتشار ({selectedIds.length.toLocaleString("fa-IR")})</button>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => void bulkSetStatus("draft")}>پیش‌نویس</button>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => void bulkSetStatus("archived")}>بایگانی</button>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => void bulkSetFeatured(true)}><Star size={15} /> ویژه</button>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => void bulkSetFeatured(false)}>حذف ویژه</button>
                          {TEAM.length > 0 ? (
                            <select
                              className="admin-lead-status-select"
                              disabled={bulkBusy}
                              defaultValue=""
                              aria-label="تخصیص مشاور به فایل‌های انتخاب‌شده"
                              onChange={(e) => {
                                const member = TEAM.find((item) => item.phone === e.target.value);
                                if (member) void bulkAssignConsultant(member);
                                e.currentTarget.value = "";
                              }}
                            >
                              <option value="">تخصیص مشاور…</option>
                              {TEAM.map((member) => (
                                <option key={member.phone} value={member.phone}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button type="button" className="btn-ghost danger" disabled={bulkBusy} onClick={() => void bulkDelete()}><Trash2 size={15} /> حذف گروهی</button>
                          <button type="button" className="btn-ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>پاک کردن انتخاب</button>
                        </>
                      ) : null}
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => void exportProperties()}>
                      <Download size={15} /> خروجی کامل CSV
                    </button>
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
                        <div style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
                          <input
                            type="checkbox"
                            aria-label={"انتخاب " + property.title}
                            checked={selectedIds.includes(property.id)}
                            onChange={() => toggleSelected(property.id)}
                            style={{ width: 18, height: 18, accentColor: "#f7f5ef" }}
                          />
                        </div>
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
                            {(() => {
                              const quality = propertyQuality(property);
                              return (
                                <span
                                  title={"امتیاز تکمیل اطلاعات: " + quality.score + " از 100"}
                                  style={{
                                    border: "1px solid " + (quality.complete ? "rgba(126, 220, 173, .28)" : "rgba(247, 245, 239, .28)"),
                                    background: quality.complete ? "rgba(126, 220, 173, .08)" : "rgba(247, 245, 239, .08)",
                                    color: quality.complete ? "#f7f5ef" : "#f7f5ef",
                                    borderRadius: 999,
                                    padding: "3px 7px",
                                    fontSize: 11,
                                  }}
                                >
                                  {quality.label} · {quality.score}
                                </span>
                              );
                            })()}
                          </div>
                          <h3>{property.title}</h3>
                          <p>
                            {property.neighborhood} · {property.contactName}
                          </p>
                        </div>
                        <div className="admin-property-actions">
                          {property.status === "draft" ? (
                            <button
                              type="button"
                              className="admin-icon-btn"
                              title="انتشار سریع"
                              onClick={() => void quickSetStatus(property, "published")}
                            >
                              <Save size={16} />
                            </button>
                          ) : property.status === "published" ? (
                            <button
                              type="button"
                              className="admin-icon-btn"
                              title="بایگانی سریع"
                              onClick={() => void quickSetStatus(property, "archived")}
                            >
                              <X size={16} />
                            </button>
                          ) : null}
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
                            href={propertyPath(property)}
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

                {propertyHasMore ? (
                  <div className="admin-properties-load-more" style={{ display: "flex", justifyContent: "center", padding: 18 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void loadMoreProperties()}
                      disabled={loadingList}
                    >
                      {loadingList ? "در حال بارگذاری…" : "نمایش فایل‌های بیشتر"}
                    </button>
                    <small>
                      نمایش {properties.length.toLocaleString("fa-IR")} از{" "}
                      {stats.total.toLocaleString("fa-IR")} فایل
                    </small>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {view === "music" ? <AdminMusicManager /> : null}
          {view === "leads" ? <AdminLeadManager /> : null}
          {view === "partners" ? <AdminPartnerManager /> : null}
          {view === "divar" ? <AdminDivarFiles /> : null}

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
                  <legend>دستیار و کیفیت آگهی</legend>
                  <AdminListingAssistant
                    transactionType={form.transactionType}
                    propertyType={form.propertyType}
                    neighborhood={form.neighborhood}
                    areaM2={form.areaM2}
                    bedrooms={form.bedrooms}
                    bathrooms={form.bathrooms}
                    builtYear={form.builtYear}
                    parking={form.parking}
                    elevator={form.elevator}
                    storage={form.storage}
                    title={form.title}
                    description={form.description}
                    features={form.features}
                    imageCount={form.images.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean).length}
                    onApplyTitle={(value) => update("title", value)}
                    onApplyDescription={(value) => update("description", value)}
                  />
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
                  <legend>قیمت و شرایط مالی</legend>
                  <AdminPricingPanel
                    transactionType={form.transactionType}
                    price={form.price}
                    deposit={form.deposit}
                    rent={form.rent}
                    onPriceChange={(value) => update("price", value)}
                    onDepositChange={(value) => update("deposit", value)}
                    onRentChange={(value) => update("rent", value)}
                  />
                  <div className="admin-form-grid" style={{ marginTop: 14 }}>
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
                        style={{ accentColor: "#f7f5ef", width: 18, height: 18 }}
                      />
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#f7f5ef", fontWeight: 600 }}>
                        <Star size={15} /> فایل ویژه
                      </span>
                    </label>
                    <label className="field">
                      <span>پایان ویژه (اختیاری)</span>
                      <input
                        type="datetime-local"
                        value={form.featuredUntil}
                        onChange={(e) => update("featuredUntil", e.target.value)}
                        disabled={!form.featured}
                      />
                      <small style={{ color: "rgb(247 245 239 / .56)", marginTop: 5 }}>
                        خالی = بدون انقضا. بعد از این زمان، فایل خودکار از اولویت «ویژه» خارج می‌شود.
                      </small>
                    </label>
                  </div>
                </fieldset>
              </div>

              {form.id ? (
                <fieldset className="admin-section">
                  <legend>تاریخچه فایل</legend>
                  {changeHistory.length === 0 ? (
                    <div className="admin-empty">
                      <span>هنوز سابقه‌ای برای این فایل ثبت نشده است.</span>
                    </div>
                  ) : (
                    <div className="admin-breakdown">
                      {changeHistory.map((item) => {
                        const before = item;
                        const after = item;
                        const changes: string[] = [];
                        if (item.action === "created") changes.push("فایل ایجاد شد");
                        if (item.action === "deleted") changes.push("فایل حذف شد");
                        if (item.action === "updated") {
                          if (before.beforeStatus !== after.afterStatus) {
                            const labels: Record<string, string> = {
                              published: "منتشرشده",
                              draft: "پیش‌نویس",
                              archived: "بایگانی",
                            };
                            changes.push(
                              "وضعیت: " +
                                (labels[String(before.beforeStatus)] ?? String(before.beforeStatus ?? "—")) +
                                " ← " +
                                (labels[String(after.afterStatus)] ?? String(after.afterStatus ?? "—")),
                            );
                          }
                          if (before.beforeFeatured !== after.afterFeatured) {
                            changes.push(after.afterFeatured === true ? "ویژه شد" : "از حالت ویژه خارج شد");
                          }
                          if (before.beforeContactName !== after.afterContactName) {
                            changes.push("مشاور تغییر کرد");
                          }
                          if (
                            before.beforeTitle !== after.afterTitle ||
                            before.beforePrice !== after.afterPrice ||
                            before.beforeDeposit !== after.afterDeposit ||
                            before.beforeRent !== after.afterRent
                          ) {
                            changes.push("اطلاعات اصلی/قیمت ویرایش شد");
                          }
                          if (!changes.length) changes.push("اطلاعات فایل ویرایش شد");
                        }

                        const title = item.afterTitle ?? item.beforeTitle ?? form.title;
                        return (
                          <div key={item.id} className="admin-breakdown-row">
                            <div>
                              <span>{changes.join(" · ")}</span>
                              <strong>
                                {new Date(item.changedAt).toLocaleDateString("fa-IR")} ·{" "}
                                {new Date(item.changedAt).toLocaleTimeString("fa-IR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </strong>
                            </div>
                            <small>{title}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              ) : null}

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
          className={view === "dashboard" ? "is-active" : ""}
          onClick={() => setView("dashboard")}
        >
          <BarChart3 size={20} />
          داشبورد
        </button>
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
        <button type="button" className={view === "divar" ? "is-active" : ""} onClick={() => setView("divar")}>
          <Globe2 size={20} />
          دیوار
        </button>
        <button type="button" className={view === "partners" ? "is-active" : ""} onClick={() => setView("partners")}>
          <UsersRound size={20} />
          همکاران
        </button>
        <Link
          to="/"
          className="admin-mobile-site"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 40,
            padding: "0 14px",
            borderRadius: 999,
            border: "1px solid rgb(255 255 255 / .2)",
            background: "rgb(255 255 255 / .06)",
            color: "#f7f5ef",
            textDecoration: "none",
            fontSize: ".8rem",
            fontWeight: 600,
          }}
        >
          سایت
        </Link>
      </nav>
    </div>
  );
}
