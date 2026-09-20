import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  Gift,
  Handshake,
  History,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UsersRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { PartnerContract, PartnerOverview, PartnerSummary } from "@/lib/partner-program.server";

type CreateForm = { agencyName: string; contactName: string; phone: string };
const EMPTY_FORM: CreateForm = { agencyName: "", contactName: "", phone: "" };

const TX_LABEL: Record<string, string> = {
  buy: "درخواست خرید",
  sell: "فروش",
  rent: "اجاره",
  mortgage: "رهن",
};
const STATUS_LABEL: Record<string, string> = { active: "فعال", suspended: "غیرفعال" };
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
};

function faDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tehran",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StampCard({ stamps, cardNumber }: { stamps: number; cardNumber: number }) {
  const nextStamp = stamps % 3 === 0 ? 3 : 3 - (stamps % 3);
  return (
    <div className="admin-partner-stamp-panel">
      <div className="admin-partner-stamp-head">
        <div>
          <span className="kicker">کارت همکاری</span>
          <strong>کارت شماره {cardNumber.toLocaleString("fa-IR")}</strong>
        </div>
        <span className="admin-partner-stamp-count">{stamps.toLocaleString("fa-IR")} / ۱۲ مهر</span>
      </div>
      <div className="admin-partner-stamp-grid" aria-label="کارت ۱۲ مهر">
        {Array.from({ length: 12 }, (_, index) => {
          const filled = index < stamps;
          return (
            <span key={index} className={"admin-partner-stamp" + (filled ? " is-filled" : "")}>
              {filled ? <Check size={15} strokeWidth={3} /> : index + 1}
            </span>
          );
        })}
      </div>
      <small>
        هر ۳ مهر = یک ثبت رایگان.{" "}
        {stamps >= 12
          ? "کارت کامل شده و آماده صدور کارت بعدی است."
          : String(nextStamp.toLocaleString("fa-IR")) + " قرارداد تا مهر/پاداش بعدی باقی مانده است."}
      </small>
    </div>
  );
}

export function AdminPartnerManager() {
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [pending, setPending] = useState<PartnerContract[]>([]);
  const [selected, setSelected] = useState<PartnerOverview | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [credentials, setCredentials] = useState<{ code: string; pin: string; agency: string } | null>(null);
  const [search, setSearch] = useState("");

  async function api<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as { statusMessage?: string; message?: string } & T;
    if (!response.ok) throw new Error(data?.statusMessage || data?.message || "عملیات انجام نشد.");
    return data;
  }

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const data = await api<{ partners: PartnerSummary[]; pendingContracts: PartnerContract[] }>({ action: "list" });
      setPartners(data.partners);
      setPending(data.pendingContracts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری همکاران انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((item) =>
      [item.agencyName, item.contactName, item.phone, item.partnerCode].join(" ").toLowerCase().includes(q),
    );
  }, [partners, search]);

  async function createPartner() {
    if (!form.agencyName.trim() || !form.contactName.trim() || !form.phone.trim()) {
      toast.error("نام املاک، مسئول و شماره تماس را کامل کنید.");
      return;
    }
    setCreating(true);
    try {
      const data = await api<{ created: { summary: PartnerSummary; partnerCode: string; pin: string } }>({
        action: "create",
        ...form,
      });
      setCredentials({
        code: data.created.partnerCode,
        pin: data.created.pin,
        agency: data.created.summary.agencyName,
      });
      setForm(EMPTY_FORM);
      toast.success("حساب همکاری ساخته شد.");
      await load(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ساخت حساب انجام نشد.");
    } finally {
      setCreating(false);
    }
  }

  async function inspectPartner(id: string) {
    setBusy("details:" + id);
    try {
      const data = await api<{ partner: PartnerOverview; contracts: PartnerContract[] }>({ action: "details", partnerId: id });
      setSelected({ ...data.partner, contracts: data.contracts });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "جزئیات همکار خوانده نشد.");
    } finally {
      setBusy("");
    }
  }

  async function approve(id: string) {
    setBusy(id);
    try {
      await api({ action: "approve", contractId: id });
      toast.success("قرارداد تأیید شد و مهر ثبت شد.");
      await load(false);
      if (selected) await inspectPartner(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تأیید انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  async function reject(id: string) {
    const note = window.prompt("دلیل رد قرارداد را وارد کنید:", "") ?? "";
    setBusy(id);
    try {
      await api({ action: "reject", contractId: id, note });
      toast.success("قرارداد رد شد.");
      await load(false);
      if (selected) await inspectPartner(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "رد قرارداد انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  async function newCard() {
    if (!selected) return;
    setBusy("card:" + selected.id);
    try {
      const data = await api<{ partner: PartnerOverview }>({ action: "new-card", partnerId: selected.id });
      setSelected(data.partner);
      await load(false);
      toast.success("کارت جدید صادر شد و شمارنده کارت از صفر شروع شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "صدور کارت جدید انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  async function claimRewardForSelected() {
    if (!selected) return;
    const note = window.prompt("توضیح مصرف پاداش (اختیاری):", "") ?? "";
    setBusy("reward:" + selected.id);
    try {
      const data = await api<{ partner: PartnerOverview }>({
        action: "claim-reward",
        partnerId: selected.id,
        note,
      });
      setSelected(data.partner);
      await load(false);
      toast.success("یک پاداش به‌عنوان مصرف‌شده ثبت شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مصرف پاداش ثبت نشد.");
    } finally {
      setBusy("");
    }
  }

  async function claimRewardFor(id: string) {
    setBusy("reward:" + id);
    try {
      const data = await api<{ partner: PartnerOverview }>({
        action: "claim-reward",
        partnerId: id,
        note: "ثبت مصرف از پنل مدیریت",
      });
      setSelected(data.partner);
      await load(false);
      toast.success("پاداش مصرف شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مصرف پاداش انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  async function toggleStatus(partner: PartnerSummary | PartnerOverview) {
    const next = partner.status === "active" ? "suspended" : "active";
    setBusy("status:" + partner.id);
    try {
      const data = await api<{ partner: PartnerOverview }>({ action: "status", partnerId: partner.id, status: next });
      setSelected(data.partner);
      await load(false);
      toast.success("حساب " + STATUS_LABEL[next] + " شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("کپی شد.");
    } catch {
      toast.error("کپی خودکار در این مرورگر در دسترس نیست.");
    }
  }

  if (loading) {
    return (
      <section className="admin-panel">
        <div className="admin-empty">
          <RefreshCw size={25} className="admin-spin" />
          <strong>در حال بارگذاری باشگاه همکاران...</strong>
        </div>
      </section>
    );
  }

  return (
    <div className="admin-partners-wrap">
      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-partner-create">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">همکار جدید</span>
              <h2>ساخت حساب املاک</h2>
            </div>
            <Handshake size={22} />
          </div>
          <p className="admin-dashboard-summary">
            برای هر دفتر یک کد همکاری و رمز ۶ رقمی ساخته می‌شود. این اطلاعات را امن به همکار بدهید و روی کارت او قرار دهید.
          </p>
          <div className="admin-form-grid">
            <label className="field">
              <span>نام املاک</span>
              <input value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} />
            </label>
            <label className="field">
              <span>نام مسئول</span>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </label>
            <label className="field admin-span-2">
              <span>شماره تماس</span>
              <input inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <button type="button" className="btn-gold" onClick={() => void createPartner()} disabled={creating}>
            {creating ? <RefreshCw size={16} className="admin-spin" /> : <Plus size={16} />}
            ساخت حساب و تولید کد
          </button>

          {credentials ? (
            <div className="admin-partner-credentials">
              <div><small>حساب ساخته شد</small><strong>{credentials.agency}</strong></div>
              <div className="admin-partner-credential-grid">
                <button type="button" onClick={() => void copy(credentials.code)} title="کپی کد همکاری">
                  <span><KeyRound size={16} /> کد همکاری</span>
                  <strong dir="ltr">{credentials.code}</strong>
                  <Copy size={15} />
                </button>
                <button type="button" onClick={() => void copy(credentials.pin)} title="کپی رمز ورود">
                  <span><KeyRound size={16} /> رمز ۶ رقمی</span>
                  <strong dir="ltr">{credentials.pin}</strong>
                  <Copy size={15} />
                </button>
              </div>
              <p>رمز فقط هنگام ساخت حساب نمایش داده می‌شود؛ آن را امن تحویل همکار بدهید.</p>
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">وضعیت همکاری</span>
              <h2>خلاصه باشگاه</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} /> تازه‌سازی
            </button>
          </div>
          <div className="admin-dashboard-mini-grid">
            <div><span>دفاتر همکار</span><strong>{partners.length.toLocaleString("fa-IR")}</strong></div>
            <div><span>فعال</span><strong>{partners.filter((p) => p.status === "active").length.toLocaleString("fa-IR")}</strong></div>
            <div><span>قرارداد در انتظار</span><strong>{pending.length.toLocaleString("fa-IR")}</strong></div>
            <div><span>پاداش آماده</span><strong>{partners.reduce((sum, p) => sum + p.availableRewards, 0).toLocaleString("fa-IR")}</strong></div>
          </div>
          <p className="admin-dashboard-summary">تأیید هر قرارداد = یک مهر. قرارداد سوم، ششم، نهم و دوازدهم، پاداش جدید ایجاد می‌کند.</p>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><span className="kicker">دفاتر همکار</span><h2>{filtered.length.toLocaleString("fa-IR")} حساب</h2></div>
          <label className="admin-search" style={{ maxWidth: 420 }}>
            <UsersRound size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی نام املاک، مسئول، تلفن یا کد..." />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="admin-empty"><Handshake size={26} /><strong>هنوز همکاری ثبت نشده</strong><p>اولین دفتر را از فرم بالا بسازید.</p></div>
        ) : (
          <div className="admin-partner-grid">
            {filtered.map((partner) => {
              const next = partner.contractCount % 3 === 0 ? 3 : 3 - (partner.contractCount % 3);
              return (
                <article key={partner.id} className="admin-partner-card" data-status={partner.status}>
                  <div className="admin-partner-card-head">
                    <div>
                      <span className="admin-partner-code" dir="ltr">{partner.partnerCode}</span>
                      <h3>{partner.agencyName}</h3>
                      <p>{partner.contactName} · {partner.phone}</p>
                    </div>
                    <span className={"admin-partner-status status-" + partner.status}>{STATUS_LABEL[partner.status]}</span>
                  </div>
                  <StampCard stamps={partner.cardStamps} cardNumber={partner.cardNumber} />
                  <div className="admin-partner-metrics">
                    <div><span>قرارداد تأییدشده</span><strong>{partner.contractCount.toLocaleString("fa-IR")}</strong></div>
                    <div><span>پاداش آماده</span><strong>{partner.availableRewards.toLocaleString("fa-IR")}</strong></div>
                    <div><span>در انتظار</span><strong>{partner.pendingContracts.toLocaleString("fa-IR")}</strong></div>
                    <div><span>تا پاداش بعدی</span><strong>{next.toLocaleString("fa-IR")} قرارداد</strong></div>
                  </div>
                  <div className="admin-partner-actions">
                    <button type="button" className="btn-ghost" onClick={() => void inspectPartner(partner.id)} disabled={busy === "details:" + partner.id}>
                      {busy === "details:" + partner.id ? <RefreshCw size={15} className="admin-spin" /> : <History size={15} />}
                      جزئیات
                    </button>
                    {partner.availableRewards > 0 ? (
                      <button type="button" className="btn-gold" onClick={() => void claimRewardFor(partner.id)} disabled={Boolean(busy)}>
                        <Gift size={15} /> ثبت مصرف رایگان
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><span className="kicker">قراردادهای ورودی</span><h2>{pending.length.toLocaleString("fa-IR")} مورد در انتظار</h2></div>
          <span className="admin-dashboard-summary">تأیید = مهر روی کارت</span>
        </div>

        {pending.length === 0 ? (
          <div className="admin-empty"><BadgeCheck size={26} /><strong>قرارداد معوقی ندارید</strong><p>هر قرارداد جدید همکار در اینجا برای تأیید نمایش داده می‌شود.</p></div>
        ) : (
          <div className="admin-partner-contract-list">
            {pending.map((contract) => (
              <article key={contract.id} className="admin-partner-contract">
                <div className="admin-partner-contract-main">
                  <div className="admin-partner-contract-code" dir="ltr"><Ticket size={15} /> {contract.trackingCode}</div>
                  <strong>{contract.agencyName}</strong>
                  <span>{TX_LABEL[contract.transactionType]}{contract.contractReference ? " · " + contract.contractReference : ""}</span>
                  <small>{contract.clientName ? "مشتری: " + contract.clientName + " · " : ""}{faDate(contract.createdAt)}</small>
                </div>
                <div className="admin-partner-contract-actions">
                  <button type="button" className="btn-gold" onClick={() => void approve(contract.id)} disabled={Boolean(busy)}>
                    {busy === contract.id ? <RefreshCw size={15} className="admin-spin" /> : <CheckCircle2 size={15} />}
                    تأیید و مهر
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => void reject(contract.id)} disabled={Boolean(busy)}>
                    <XCircle size={15} /> رد
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <section className="admin-panel admin-partner-detail">
          <div className="admin-panel-head">
            <div>
              <span className="kicker">پرونده همکار</span>
              <h2>{selected.agencyName}</h2>
              <p>{selected.contactName} · {selected.phone} · {selected.partnerCode}</p>
            </div>
            <div className="admin-partner-detail-head-actions">
              <button type="button" className="btn-ghost" onClick={() => void toggleStatus(selected)} disabled={Boolean(busy)}>
                <ShieldCheck size={15} /> {selected.status === "active" ? "غیرفعال‌کردن" : "فعال‌کردن"}
              </button>
              {selected.cardStamps >= 12 ? (
                <button type="button" className="btn-gold" onClick={() => void newCard()} disabled={Boolean(busy)}>
                  <Plus size={15} /> صدور کارت جدید
                </button>
              ) : null}
              {selected.availableRewards > 0 ? (
                <button type="button" className="btn-gold" onClick={() => void claimRewardForSelected()} disabled={Boolean(busy)}>
                  <Gift size={15} /> ثبت مصرف پاداش
                </button>
              ) : null}
            </div>
          </div>

          <StampCard stamps={selected.cardStamps} cardNumber={selected.cardNumber} />

          <div className="admin-dashboard-mini-grid">
            <div><span>کل قرارداد تأییدشده</span><strong>{selected.contractCount.toLocaleString("fa-IR")}</strong></div>
            <div><span>پاداش کسب‌شده</span><strong>{selected.rewardsEarned.toLocaleString("fa-IR")}</strong></div>
            <div><span>پاداش قابل استفاده</span><strong>{selected.availableRewards.toLocaleString("fa-IR")}</strong></div>
            <div><span>آخرین ورود</span><strong>{selected.lastLoginAt ? faDate(selected.lastLoginAt) : "هنوز وارد نشده"}</strong></div>
          </div>

          <div className="admin-partner-history">
            <div className="admin-panel-head"><div><span className="kicker">تاریخچه</span><h3>قراردادهای این همکار</h3></div></div>
            {selected.contracts.length === 0 ? (
              <div className="admin-empty"><History size={22} /><strong>هنوز قراردادی ثبت نشده</strong></div>
            ) : (
              <div className="admin-partner-contract-list">
                {selected.contracts.map((contract) => (
                  <article key={contract.id} className="admin-partner-contract">
                    <div className="admin-partner-contract-main">
                      <div className="admin-partner-contract-code" dir="ltr"><Ticket size={15} /> {contract.trackingCode}</div>
                      <strong>{CONTRACT_STATUS_LABEL[contract.status]}</strong>
                      <span>{TX_LABEL[contract.transactionType]}{contract.contractReference ? " · " + contract.contractReference : ""}</span>
                      <small>{contract.clientName || "بدون نام مشتری"} · {faDate(contract.createdAt)}</small>
                      {contract.decisionNote ? <small>یادداشت: {contract.decisionNote}</small> : null}
                    </div>
                    <span className={"admin-partner-status status-" + contract.status}>{CONTRACT_STATUS_LABEL[contract.status]}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
