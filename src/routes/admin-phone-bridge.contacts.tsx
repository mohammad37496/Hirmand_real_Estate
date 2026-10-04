import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ContactRound, RefreshCw, Search, Smartphone, UserPlus, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  listPhoneBridgeContacts,
  listPhoneBridgeNewContacts,
  type PhoneBridgeContact,
} from "@/lib/admin-phone-bridge-contacts";
import "@/admin-phone-bridge-contacts.css";

function fa(value: number) {
  return value.toLocaleString("fa-IR");
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("fa-IR") : "—";
}

function ContactNumbers({ numbers }: { numbers: string[] }) {
  return (
    <div className="pbc-numbers">
      {numbers.length ? numbers.map((number) => (
        <a key={number} href={"tel:" + encodeURIComponent(number)} className="pbc-number">
          <Phone size={14} /> {number}
        </a>
      )) : <span className="pbc-muted">شماره‌ای ثبت نشده</span>}
    </div>
  );
}

function ContactCard({ contact }: { contact: PhoneBridgeContact }) {
  return (
    <article className="pbc-contact-card">
      <div className="pbc-avatar"><ContactRound size={21} /></div>
      <div className="pbc-contact-main">
        <h3>{contact.name || "بدون نام"}</h3>
        <ContactNumbers numbers={contact.numbers} />
        <div className="pbc-meta">
          <span>ثبت در Phone Bridge: {date(contact.firstSeenAt)}</span>
          <span>آخرین تغییر دفترچه: {date(contact.phoneUpdatedAt)}</span>
          <span>آخرین مشاهده: {date(contact.lastSeenAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function AdminPhoneBridgeContacts() {
  const [devices, setDevices] = useState<{ id: string; name: string; model: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [contacts, setContacts] = useState<PhoneBridgeContact[]>([]);
  const [newContacts, setNewContacts] = useState<PhoneBridgeContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const loadDevices = useCallback(async () => {
    const result = await (await import("@/lib/admin-phone-bridge")).listPhoneBridgeDevices({ data: { limit: 100 } });
    const mapped = result.map((d) => ({ id: d.id, name: d.name, model: d.model }));
    setDevices(mapped);
    if (!deviceId && mapped[0]) setDeviceId(mapped[0].id);
  }, [deviceId]);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setBusy(true);
    try {
      const [allResult, freshResult] = await Promise.all([
        listPhoneBridgeContacts({ data: { deviceId, page, limit: pageSize, search } }),
        listPhoneBridgeNewContacts({ data: { deviceId, limit: 50, sinceDays: 30 } }),
      ]);
      setContacts(allResult.contacts);
      setTotal(allResult.total);
      setNewContacts(freshResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت مخاطبین انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, [deviceId, page, search]);

  useEffect(() => { void loadDevices(); }, [loadDevices]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const newCountText = useMemo(() => fa(newContacts.length), [newContacts.length]);

  return (
    <main className="pbc-page" dir="rtl">
      <header className="pbc-header">
        <div>
          <span>Phone Bridge · مخاطبین</span>
          <h1>مخاطبین گوشی</h1>
          <p>مخاطبین ثبت‌شدهٔ گوشی همراه شماره‌ها، زمان ثبت اولیه در Phone Bridge و زمان آخرین تغییر دفترچه تلفن نمایش داده می‌شوند.</p>
        </div>
        <div className="pbc-actions">
          <Link to="/admin-phone-bridge"><ArrowRight size={16} /> Phone Bridge</Link>
          <button type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> بروزرسانی</button>
        </div>
      </header>

      <section className="pbc-toolbar">
        <label className="pbc-field">
          <span>دستگاه</span>
          <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setPage(1); }}>
            {!devices.length ? <option value="">دستگاهی نیست</option> : null}
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.model}</option>)}
          </select>
        </label>
        <label className="pbc-field pbc-search">
          <span>جستجو</span>
          <div className="pbc-search-box"><Search size={17} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="نام، شماره یا شناسه مخاطب" /></div>
        </label>
        <div className="pbc-stats"><span><ContactRound size={15} /> {fa(total)} مخاطب</span><span><UserPlus size={15} /> {newCountText} مورد تازه شناسایی‌شده در ۳۰ روز</span><span><Smartphone size={15} /> فقط دستگاه انتخاب‌شده</span></div>
      </section>

      <section className="pbc-card">
        <div className="pbc-card-head">
          <div>
            <span>بخش اول</span>
            <h2>مخاطبین تازه شناسایی‌شده</h2>
          </div>
          <small>آخرین ۵۰ مورد</small>
        </div>
        <div className="pbc-list">
          {busy ? <div className="pbc-empty">در حال دریافت…</div> :
            newContacts.length ? newContacts.map((contact) => <ContactCard key={contact.id} contact={contact} />) :
            <div className="pbc-empty">در ۳۰ روز اخیر مخاطب تازه‌ای در Phone Bridge شناسایی نشده است.</div>}
        </div>
      </section>

      <section className="pbc-card">
        <div className="pbc-card-head">
          <div>
            <span>بخش دوم</span>
            <h2>تمام مخاطبین ذخیره‌شده</h2>
          </div>
          <small>{fa(total)} مورد</small>
        </div>
        <div className="pbc-list">
          {busy ? <div className="pbc-empty">در حال دریافت…</div> :
            contacts.length ? contacts.map((contact) => <ContactCard key={contact.id} contact={contact} />) :
            <div className="pbc-empty">مخاطبی ثبت نشده است؛ در گوشی مجوز مخاطبین را فعال و Sync را اجرا کن.</div>}
        </div>
      </section>

      <section className="pbc-pagination">
        <button type="button" disabled={page <= 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))}>قبلی</button>
        <span>صفحه {fa(page)} از {fa(pageCount)} · {fa(total)} مخاطب</span>
        <button type="button" disabled={page >= pageCount || busy} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>بعدی</button>
      </section>

      <aside className="pbc-note">
        <strong>نکته دربارهٔ تاریخ مخاطب:</strong> Android به‌صورت عمومی زمان دقیق «ایجاد مخاطب» را ارائه نمی‌کند. بنابراین «ثبت در Phone Bridge» زمان اولین مشاهده و ثبت این مخاطب روی سرور است و «آخرین تغییر دفترچه» زمان تغییر ثبت‌شده توسط Contacts Provider است.
      </aside>
    </main>
  );
}

export const Route = createFileRoute("/admin-phone-bridge/contacts")({
  component: AdminPhoneBridgeContacts,
  head: () => ({ meta: [
    { title: "Phone Bridge · مخاطبین | گروه مشاورین املاک هیرمند" },
    { name: "description", content: "فهرست و تاریخچهٔ مخاطبین Phone Bridge" },
  ]}),
});
