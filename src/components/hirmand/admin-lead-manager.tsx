import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, MessageCircle, Phone, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SITE } from "@/lib/site";
import { formatToman } from "@/lib/money";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";
type Lead = {
  id: string;
  name: string;
  phone: string;
  deal: string;
  propertyType: string;
  neighborhood: string;
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
  budgetDeposit: number | null;
  budgetRent: number | null;
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
      return [lead.name, lead.phone, lead.deal, lead.propertyType, lead.neighborhood, lead.consultant, lead.note]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, query, statusFilter]);

  function budgetWhatsappHref(lead: Lead) {
    const lines = [
      "سلام " + lead.name + "،",
      "نتیجه بررسی بودجه شما از طرف هیرمند:",
      lead.budgetDeposit ? "رهن: " + formatToman(lead.budgetDeposit) + " تومان" : "",
      lead.budgetRent ? "اجاره ماهانه: " + formatToman(lead.budgetRent) + " تومان" : "",
      lead.neighborhood ? "محله: " + lead.neighborhood : "",
      lead.budgetBedrooms ? "حداقل خواب: " + lead.budgetBedrooms : "",
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
                    {lead.deal}
                    {lead.propertyType ? " · " + lead.propertyType : ""}
                    {lead.neighborhood ? " · " + lead.neighborhood : ""}
                    {lead.consultant ? " · مشاور: " + lead.consultant : ""}
                  </p>
                  {lead.source === "budget_match" ? (
                    <div className="admin-lead-budget">
                      <div>
                        <span>رهن</span>
                        <strong>{lead.budgetDeposit ? formatToman(lead.budgetDeposit) : "—"}</strong>
                      </div>
                      <div>
                        <span>اجاره</span>
                        <strong>{lead.budgetRent ? formatToman(lead.budgetRent) : "—"}</strong>
                      </div>
                      <div>
                        <span>معادل رهنی</span>
                        <strong>{lead.budgetEquivalent ? formatToman(lead.budgetEquivalent) : "—"}</strong>
                      </div>
                      <div>
                        <span>فایل پیشنهادی</span>
                        <strong>{lead.matchCount.toLocaleString("fa-IR")} مورد</strong>
                      </div>
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
                      پیگیری: <strong>{formatDate(lead.followUpAt)}</strong>
                    </div>
                  ) : null}
                  {lead.acquisitionSource ? (
                    <div className="admin-lead-attribution">
                      منبع جذب: <strong>{lead.acquisitionSource}</strong>
                      {lead.acquisitionMedium ? " · " + lead.acquisitionMedium : ""}
                      {lead.acquisitionCampaign ? " · کمپین: " + lead.acquisitionCampaign : ""}
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
