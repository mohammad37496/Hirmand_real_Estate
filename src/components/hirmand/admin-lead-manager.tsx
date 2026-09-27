import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, ExternalLink, Loader2, MessageCircle, Phone, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SITE } from "@/lib/site";
import { formatToman } from "@/lib/money";
import { PROPERTY_OTHER_AMENITY_OPTIONS } from "@/lib/property-options";
import { daysUntilDateOnly, formatPersianDate } from "@/lib/persian-date";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";
type Lead = {
  id: string;
  name: string;
  phone: string;
  peopleCount: number | null;
  job: string;
  deal: string;
  propertyType: string;
  neighborhood: string;
  floorPreference: string;
  requestedAmenities: string[];
  consultant: string;
  note: string;
  status: LeadStatus;
  createdAt: string;
  source: string;
  acquisitionSource: string | null;
  acquisitionMedium: string | null;
  acquisitionCampaign: string | null;
  acquisitionReferrer: string | null;
  followUpAt: string | null;
  lastContactedAt: string | null;
  leaseDeadline: string | null;
  budgetDeposit: number | null;
  budgetRent: number | null;
  budgetPurchase: number | null;
  budgetSale: number | null;
  budgetDepositMin: number | null;
  budgetDepositMax: number | null;
  budgetRentMin: number | null;
  budgetRentMax: number | null;
  budgetPurchaseMin: number | null;
  budgetPurchaseMax: number | null;
  budgetSaleMin: number | null;
  budgetSaleMax: number | null;
  requestedBedrooms: number | null;
  budgetEquivalent: number | null;
  budgetBedrooms: number | null;
  budgetRate: number | null;
  matchCount: number;
  matchedProperties: Array<{
    slug: string;
    title: string;
    tier: "within" | "convertible" | "near";
    score: number;
    suggestedDeposit: number;
    suggestedRent: number;
  }>;
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  follow_up: "پیگیری",
  visited: "بازدید",
  contract: "قرارداد",
  closed: "ناموفق / بسته‌شده",
  spam: "اسپم",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function leaseDeadlineMeta(value: string) {
  const days = daysUntilDateOnly(value);
  if (days == null) return { tone: "normal", text: "" };
  if (days < 0) return { tone: "expired", text: "مهلت گذشته" };
  if (days === 0) return { tone: "today", text: "مهلت امروز است" };
  if (days === 1) return { tone: "soon", text: "۱ روز باقی مانده" };
  return { tone: days <= 7 ? "soon" : "normal", text: days.toLocaleString("fa-IR") + " روز باقی مانده" };
}

function formatBudgetRange(min: number | null, max: number | null, fallback: number | null) {
  const lower = min ?? fallback;
  const upper = max ?? fallback;
  if (!lower && !upper) return "—";
  if ((lower ?? 0) === (upper ?? 0)) return formatToman(lower ?? upper ?? 0);
  return formatToman(lower ?? upper ?? 0) + " تا " + formatToman(upper ?? lower ?? 0);
}

function amenityLabel(value: string) {
  if (value === "parking") return "پارکینگ";
  if (value === "elevator") return "آسانسور";
  if (value === "storage") return "انباری";
  return PROPERTY_OTHER_AMENITY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function AdminLeadManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(failure?.statusMessage || failure?.message || "بارگذاری درخواست‌ها انجام نشد.");
      }
      const data = (await response.json()) as { leads?: Lead[] };
      setLeads(Array.isArray(data.leads) ? data.leads : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری درخواست‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: LeadStatus) {
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", id, status }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(result?.statusMessage || result?.message || "تغییر وضعیت انجام نشد.");
      }
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.");
    }
  }

  async function remove(id: string) {
    if (!confirm("این درخواست حذف شود؟")) return;
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(failure?.statusMessage || failure?.message || "حذف درخواست انجام نشد.");
      }
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف درخواست انجام نشد.");
    }
  }

  const newCount = leads.filter((lead) => lead.status === "new").length;

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!q) return true;
      return [
        lead.name,
        lead.phone,
        lead.peopleCount == null ? "" : String(lead.peopleCount),
        lead.job,
        lead.deal,
        lead.propertyType,
        lead.neighborhood,
        lead.floorPreference,
        lead.requestedAmenities.join(" "),
        lead.consultant,
        lead.note,
        lead.budgetDeposit == null ? "" : String(lead.budgetDeposit),
        lead.budgetRent == null ? "" : String(lead.budgetRent),
        lead.budgetPurchase == null ? "" : String(lead.budgetPurchase),
        lead.budgetSale == null ? "" : String(lead.budgetSale),
        lead.budgetDepositMin == null ? "" : String(lead.budgetDepositMin),
        lead.budgetDepositMax == null ? "" : String(lead.budgetDepositMax),
        lead.budgetRentMin == null ? "" : String(lead.budgetRentMin),
        lead.budgetRentMax == null ? "" : String(lead.budgetRentMax),
        lead.budgetPurchaseMin == null ? "" : String(lead.budgetPurchaseMin),
        lead.budgetPurchaseMax == null ? "" : String(lead.budgetPurchaseMax),
        lead.budgetSaleMin == null ? "" : String(lead.budgetSaleMin),
        lead.budgetSaleMax == null ? "" : String(lead.budgetSaleMax),
        lead.requestedBedrooms == null ? "" : String(lead.requestedBedrooms),
        lead.leaseDeadline == null ? "" : lead.leaseDeadline,
        lead.leaseDeadline ? formatPersianDate(lead.leaseDeadline) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, query, statusFilter]);

  function budgetWhatsappHref(lead: Lead) {
    const lines = [
      "سلام " + lead.name + "،",
      "نتیجه بررسی بودجه شما از طرف هیرمند:",
      lead.budgetDeposit || lead.budgetDepositMin || lead.budgetDepositMax
        ? "رهن: " + formatBudgetRange(lead.budgetDepositMin, lead.budgetDepositMax, lead.budgetDeposit) + " تومان"
        : "",
      lead.budgetRent || lead.budgetRentMin || lead.budgetRentMax
        ? "اجاره ماهانه: " + formatBudgetRange(lead.budgetRentMin, lead.budgetRentMax, lead.budgetRent) + " تومان"
        : "",
      lead.budgetPurchase || lead.budgetPurchaseMin || lead.budgetPurchaseMax
        ? "بودجه خرید: " + formatBudgetRange(lead.budgetPurchaseMin, lead.budgetPurchaseMax, lead.budgetPurchase) + " تومان"
        : "",
      lead.budgetSale || lead.budgetSaleMin || lead.budgetSaleMax
        ? "بودجه فروش: " + formatBudgetRange(lead.budgetSaleMin, lead.budgetSaleMax, lead.budgetSale) + " تومان"
        : "",
      lead.leaseDeadline && (lead.deal === "رهن" || lead.deal === "اجاره" || lead.deal === "رهن و اجاره")
        ? "مهلت رهن و اجاره: " + formatPersianDate(lead.leaseDeadline)
        : "",
      lead.neighborhood ? "محله: " + lead.neighborhood : "",
      lead.requestedBedrooms != null
        ? "تعداد خواب موردنظر: " + (lead.requestedBedrooms === 0 ? "بدون خواب / استودیو" : lead.requestedBedrooms >= 6 ? "۶ خواب و بیشتر" : lead.requestedBedrooms.toLocaleString("fa-IR") + " خواب")
        : "",
      lead.budgetBedrooms ? "حداقل خواب بودجه‌یابی: " + lead.budgetBedrooms : "",
      "",
      "فایل‌های پیشنهادی:",
      ...lead.matchedProperties.slice(0, 5).map((item, index) =>
        (index + 1) + ". " + item.title + " — " + SITE.url + "/properties/" + item.slug
      ),
      "",
      "برای هماهنگی بازدید با ما در تماس باشید.",
    ].filter(Boolean);
    return (
      "https://wa.me/" +
      lead.phone.replace(/^0/, "98") +
      "?text=" +
      encodeURIComponent(lines.join("\n"))
    );
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "export",
          query: query.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { statusMessage?: string; message?: string }
          | null;
        throw new Error(result?.statusMessage || result?.message || "خروجی CSV آماده نشد.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "hirmand-leads.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("خروجی کامل CRM آماده شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خروجی CSV آماده نشد.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="admin-lead-manager">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="kicker">CRM</span>
            <h2>{filteredLeads.length.toLocaleString("fa-IR")} درخواست · {newCount.toLocaleString("fa-IR")} جدید</h2>
          </div>
          <div className="admin-list-toolbar">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جستجوی نام، تلفن، محله…"
                aria-label="جستجوی درخواست‌ها"
              />
            </label>
            <select
              className="admin-lead-status-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | LeadStatus)}
              aria-label="فیلتر وضعیت"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="new">جدید</option>
              <option value="contacted">تماس گرفته شد</option>
              <option value="follow_up">پیگیری</option>
              <option value="visited">بازدید</option>
              <option value="contract">قرارداد</option>
              <option value="closed">ناموفق / بسته‌شده</option>
              <option value="spam">اسپم</option>
            </select>
            <button type="button" className="btn-ghost" onClick={() => void exportCsv()} disabled={exporting}>
              <Download size={16} />
              {exporting ? "در حال ساخت…" : "خروجی CSV"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => void load()}>
              به‌روزرسانی
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty">
            <Loader2 size={24} className="admin-spin" />
            <strong>در حال بارگذاری درخواست‌ها...</strong>
          </div>
        ) : leads.length === 0 ? (
          <div className="admin-empty">
            <UserRound size={30} />
            <strong>هنوز درخواستی ثبت نشده</strong>
            <p>Leadهای فرم درخواست ملک اینجا نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div className="admin-lead-list">
            {filteredLeads.map((lead) => (
              <article key={lead.id} className="admin-lead-card">
                <div className="admin-lead-main">
                  <div className="admin-lead-title">
                    <strong>{lead.name}</strong>
                    <span className={"admin-lead-status status-" + lead.status}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                    {lead.source === "budget_match" ? (
                      <span className="admin-lead-budget-badge">بودجه‌یابی</span>
                    ) : null}
                  </div>
                  <a className="admin-lead-phone" href={"tel:" + lead.phone}>
                    <Phone size={15} /> {lead.phone}
                  </a>
                  <p>
                    {lead.peopleCount ? "تعداد نفرات: " + lead.peopleCount.toLocaleString("fa-IR") + " · " : ""}
                    {lead.job ? "شغل: " + lead.job + " · " : ""}
                    {lead.deal}
                    {lead.propertyType ? " · " + lead.propertyType : ""}
                    {lead.neighborhood ? " · " + lead.neighborhood : ""}
                    {lead.floorPreference ? " · طبقه: " + lead.floorPreference : ""}
                    {lead.requestedBedrooms != null ? " · خواب: " + (lead.requestedBedrooms === 0 ? "بدون خواب" : lead.requestedBedrooms >= 6 ? "۶+" : lead.requestedBedrooms.toLocaleString("fa-IR")) : ""}
                    {lead.requestedAmenities.length ? " · " + lead.requestedAmenities.length.toLocaleString("fa-IR") + " امکان انتخابی" : ""}
                    {lead.consultant ? " · مشاور: " + lead.consultant : ""}
                  </p>
                  {(lead.budgetDeposit != null ||
                    lead.budgetRent != null ||
                    lead.budgetPurchase != null ||
                    lead.budgetSale != null ||
                    lead.budgetDepositMin != null ||
                    lead.budgetDepositMax != null ||
                    lead.budgetRentMin != null ||
                    lead.budgetRentMax != null ||
                    lead.budgetPurchaseMin != null ||
                    lead.budgetPurchaseMax != null ||
                    lead.budgetSaleMin != null ||
                    lead.budgetSaleMax != null ||
                    lead.budgetEquivalent != null) ? (
                    <div className="admin-lead-budget">
                      {lead.deal === "رهن" || lead.deal === "اجاره" || lead.deal === "رهن و اجاره" ? (
                        <>
                          <div>
                            <span>بازه رهن</span>
                            <strong>{formatBudgetRange(lead.budgetDepositMin, lead.budgetDepositMax, lead.budgetDeposit)}</strong>
                          </div>
                          <div>
                            <span>بازه اجاره</span>
                            <strong>{formatBudgetRange(lead.budgetRentMin, lead.budgetRentMax, lead.budgetRent)}</strong>
                          </div>
                        </>
                      ) : lead.deal === "خرید" ? (
                        <div>
                          <span>بازه مبلغ خرید</span>
                          <strong>{formatBudgetRange(lead.budgetPurchaseMin, lead.budgetPurchaseMax, lead.budgetPurchase)}</strong>
                        </div>
                      ) : lead.deal === "فروش" ? (
                        <div>
                          <span>بازه مبلغ فروش</span>
                          <strong>{formatBudgetRange(lead.budgetSaleMin, lead.budgetSaleMax, lead.budgetSale)}</strong>
                        </div>
                      ) : null}
                      {lead.budgetEquivalent != null ? (
                        <div>
                          <span>معادل رهنی</span>
                          <strong>{lead.budgetEquivalent ? formatToman(lead.budgetEquivalent) : "—"}</strong>
                        </div>
                      ) : null}
                      {lead.matchCount > 0 ? (
                        <div>
                          <span>فایل پیشنهادی</span>
                          <strong>{lead.matchCount.toLocaleString("fa-IR")} مورد</strong>
                        </div>
                      ) : null}
                      {lead.matchedProperties.length ? (
                        <div className="admin-lead-matches">
                          {lead.matchedProperties.slice(0, 5).map((item) => (
                            <a key={item.slug} href={SITE.url + "/properties/" + item.slug} target="_blank" rel="noreferrer">
                              {item.title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {lead.followUpAt ? (
                    <div className={new Date(lead.followUpAt).getTime() <= Date.now() ? "admin-lead-followup is-due" : "admin-lead-followup"}>
                      پیگیری بعدی: <strong>{formatDate(lead.followUpAt)}</strong>
                    </div>
                  ) : null}
                  <div className="admin-lead-created-at">
                    تاریخ ثبت درخواست: <strong>{formatDate(lead.createdAt)}</strong>
                  </div>
                  {lead.leaseDeadline && (lead.deal === "رهن" || lead.deal === "اجاره" || lead.deal === "رهن و اجاره") ? (
                    (() => {
                      const meta = leaseDeadlineMeta(lead.leaseDeadline);
                      return (
                        <div className={"admin-lead-deadline is-" + meta.tone}>
                          <CalendarDays size={15} aria-hidden="true" />
                          <span>مهلت رهن و اجاره: <strong>{formatPersianDate(lead.leaseDeadline)}</strong></span>
                          {meta.text ? <b>{meta.text}</b> : null}
                        </div>
                      );
                    })()
                  ) : null}
                  {lead.acquisitionSource ? (
                    <div className="admin-lead-attribution">
                      منبع جذب: <strong>{lead.acquisitionSource}</strong>
                      {lead.acquisitionMedium ? " · " + lead.acquisitionMedium : ""}
                      {lead.acquisitionCampaign ? " · کمپین: " + lead.acquisitionCampaign : ""}
                    </div>
                  ) : null}
                  {lead.requestedBedrooms != null ? (
                    <div className="admin-lead-bedroom">
                      خواب موردنظر: <strong>{lead.requestedBedrooms === 0 ? "بدون خواب / استودیو" : lead.requestedBedrooms >= 6 ? "۶ خواب و بیشتر" : lead.requestedBedrooms.toLocaleString("fa-IR") + " خواب"}</strong>
                    </div>
                  ) : null}
                  {lead.requestedAmenities.length ? (
                    <div className="admin-lead-amenities" aria-label="امکانات موردنظر">
                      <span>امکانات:</span>
                      <div>
                        {lead.requestedAmenities.slice(0, 6).map((value) => (
                          <span key={value} className="admin-lead-amenity-chip">{amenityLabel(value)}</span>
                        ))}
                        {lead.requestedAmenities.length > 6 ? (
                          <span className="admin-lead-amenity-more">+{(lead.requestedAmenities.length - 6).toLocaleString("fa-IR")}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {lead.note ? <div className="admin-lead-note">{lead.note}</div> : null}
                  <small>{formatDate(lead.createdAt)}</small>
                </div>

                <div className="admin-lead-actions">
                  <a
                    className="admin-icon-btn"
                    href={
                      "https://wa.me/" +
                      lead.phone.replace(/^0/, "98") +
                      "?text=" +
                      encodeURIComponent("سلام، از دفتر هیرمند درباره درخواست شما تماس می‌گیریم.")
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title="واتساپ"
                  >
                    <ExternalLink size={16} />
                  </a>
                  {lead.source === "budget_match" && lead.matchedProperties.length ? (
                    <a
                      className="admin-icon-btn admin-budget-send"
                      href={budgetWhatsappHref(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="ارسال فایل‌های پیشنهادی"
                    >
                      <MessageCircle size={16} />
                    </a>
                  ) : null}
                  <select
                    className="admin-lead-status-select"
                    value={lead.status}
                    onChange={(event) => void updateStatus(lead.id, event.target.value as LeadStatus)}
                    aria-label="وضعیت درخواست"
                  >
                    <option value="new">جدید</option>
                    <option value="contacted">تماس گرفته شد</option>
                    <option value="follow_up">پیگیری</option>
                    <option value="visited">بازدید</option>
                    <option value="contract">قرارداد</option>
                    <option value="closed">ناموفق / بسته‌شده</option>
                    <option value="spam">اسپم</option>
                  </select>
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => void remove(lead.id)}
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
