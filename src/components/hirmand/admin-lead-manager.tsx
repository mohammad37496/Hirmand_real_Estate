import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, ExternalLink, Loader2, Phone, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type LeadStatus = "new" | "contacted" | "closed" | "spam";
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
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "در حال پیگیری",
  closed: "بسته‌شده",
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/leads-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!response.ok) throw new Error("بارگذاری درخواست‌ها انجام نشد.");
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
        body: JSON.stringify({ action: "status", adminKey, id, status }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { statusMessage?: string } | null;
        throw new Error(result?.statusMessage || "تغییر وضعیت انجام نشد.");
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
        body: JSON.stringify({ action: "delete", adminKey, id }),
      });
      if (!response.ok) throw new Error("حذف درخواست انجام نشد.");
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

  function exportCsv() {
    const header = ["نام", "تلفن", "معامله", "نوع ملک", "محله", "مشاور", "وضعیت", "توضیحات", "تاریخ"];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.phone,
      lead.deal,
      lead.propertyType,
      lead.neighborhood,
      lead.consultant,
      STATUS_LABEL[lead.status],
      lead.note,
      formatDate(lead.createdAt),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(","),
      )
      .join("\n");

    const blob = new Blob(["\\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hirmand-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
              <option value="contacted">در حال پیگیری</option>
              <option value="closed">بسته‌شده</option>
              <option value="spam">اسپم</option>
            </select>
            <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!filteredLeads.length}>
              <Download size={16} />
              خروجی CSV
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
                  <select
                    className="admin-lead-status-select"
                    value={lead.status}
                    onChange={(event) => void updateStatus(lead.id, event.target.value as LeadStatus)}
                    aria-label="وضعیت درخواست"
                  >
                    <option value="new">جدید</option>
                    <option value="contacted">در حال پیگیری</option>
                    <option value="closed">بسته‌شده</option>
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
