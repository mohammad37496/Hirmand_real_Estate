import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Film, ImageIcon, Phone, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { TEAM } from "@/lib/site";
import { formatToman } from "@/lib/money";

type Submission = {
  id: string;
  leadId: string | null;
  trackingToken: string;
  status: string;
  ownerName: string;
  ownerPhone: string;
  propertyData: Record<string, unknown>;
  reviewNote: string;
  propertyId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

function faDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle:"short", timeStyle:"short", timeZone:"Asia/Tehran" }).format(new Date(value));
  } catch { return value; }
}

function priceText(data: Record<string, unknown>) {
  const tx = String(data.transactionType ?? "");
  const price = data.price ? formatToman(Number(data.price)) : "";
  const deposit = data.deposit ? formatToman(Number(data.deposit)) : "";
  const rent = data.rent ? formatToman(Number(data.rent)) : "";
  if (tx === "sell" && price) return "قیمت: " + price + " تومان";
  if (tx === "rent") return ["رهن: " + (deposit || "—") + " تومان", "اجاره: " + (rent || "—") + " تومان"].join(" · ");
  if (tx === "mortgage" && deposit) return "رهن: " + deposit + " تومان";
  return price || deposit || rent || "قیمت ثبت نشده";
}

function labelTransaction(value: unknown) {
  return ({ buy:"خرید", sell:"فروش", rent:"اجاره", mortgage:"رهن" } as Record<string,string>)[String(value ?? "")] ?? String(value ?? "—");
}

function labelType(value: unknown) {
  return ({ apartment:"آپارتمان", villa:"ویلا و باغ", office:"اداری", heritage:"خانه اصیل", land:"زمین", commercial:"تجاری" } as Record<string,string>)[String(value ?? "")] ?? String(value ?? "—");
}

function mediaItems(data: Record<string, unknown>) {
  return Array.isArray(data.images) ? data.images.filter((v): v is string => typeof v === "string") : [];
}

export function AdminCustomerPropertySubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [consultant, setConsultant] = useState(TEAM[0]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin-customer-property-submissions", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({ action:"list", status:"pending" }),
      });
      const data = await response.json().catch(() => null) as { submissions?:Submission[]; total?:number; statusMessage?:string } | null;
      if (!response.ok) throw new Error(data?.statusMessage || "صف ثبت ملک مشتری بارگذاری نشد.");
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setTotal(Number(data?.total) || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بارگذاری درخواست‌ها انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function act(action: "approve" | "reject", submission: Submission) {
    if (busyId) return;
    if (action === "approve") {
      const ok = window.confirm("این ملک با مشاور «" + consultant.name + "» منتشر شود؟ پس از تأیید وارد فایل‌های عمومی خواهد شد.");
      if (!ok) return;
    } else {
      const ok = window.confirm("این درخواست ثبت ملک رد شود؟");
      if (!ok) return;
    }
    setBusyId(submission.id);
    try {
      const response = await fetch("/api/admin-customer-property-submissions", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action,
          id: submission.id,
          consultantName: consultant.name,
          consultantPhone: consultant.phone,
          reviewNote: reviewNote.trim(),
        }),
      });
      const data = await response.json().catch(() => null) as { success?:boolean; slug?:string; statusMessage?:string } | null;
      if (!response.ok || !data?.success) throw new Error(data?.statusMessage || "عملیات انجام نشد.");
      toast.success(action === "approve" ? "ملک تأیید و منتشر شد." : "درخواست رد شد.");
      setSelected(null);
      setReviewNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  const pendingLabel = useMemo(() => total.toLocaleString("fa-IR") + " درخواست در انتظار بررسی", [total]);

  return (
    <section className="admin-customer-submissions admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="kicker">ثبت ملک مشتری</span>
          <h2>صف بررسی و انتشار فایل</h2>
          <p className="admin-customer-submissions-subtitle">{pendingLabel} · هیچ فایل قبل از تأیید در لیست عمومی منتشر نمی‌شود.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "admin-spin" : undefined}/> بروزرسانی
        </button>
      </div>

      <div className="admin-customer-submissions-toolbar">
        <label className="field">
          <span>مشاور انتشار</span>
          <select value={consultant.phone} onChange={(e) => {
            const found = TEAM.find((person) => person.phone === e.target.value);
            if (found) setConsultant(found);
          }}>
            {TEAM.map((person) => <option key={person.phone} value={person.phone}>{person.name} · {person.role}</option>)}
          </select>
        </label>
        <div className="admin-customer-submissions-note">ابتدا اطلاعات و رسانه‌ها را بررسی کنید، سپس مشاور انتشار را انتخاب کرده و تأیید کنید.</div>
      </div>

      {loading && !submissions.length ? <div className="admin-customer-submissions-empty">در حال دریافت درخواست‌های مشتری…</div> :
       !submissions.length ? <div className="admin-customer-submissions-empty"><CheckCircle2 size={22}/><strong>صف بررسی خالی است.</strong><span>فعلاً ثبت ملک جدیدی منتظر تأیید نیست.</span></div> :
       <div className="admin-customer-submissions-list">
        {submissions.map((submission) => {
          const data = submission.propertyData;
          const media = mediaItems(data);
          const firstImage = media.find((src) => !src.toLowerCase().includes("/video/") && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(src)) || media[0] || "";
          const selectedOpen = selected?.id === submission.id;
          return (
            <article key={submission.id} className={"admin-customer-submission-card" + (selectedOpen ? " is-open" : "")}>
              <div className="admin-customer-submission-main">
                <div className="admin-customer-submission-cover">
                  {firstImage ? <img src={firstImage} alt="" loading="lazy"/> : <ImageIcon size={25}/>}
                  <span>{media.length.toLocaleString("fa-IR")} رسانه</span>
                </div>
                <div className="admin-customer-submission-copy">
                  <div className="admin-customer-submission-head">
                    <div><strong>{String(data.title ?? "بدون عنوان")}</strong><span>{labelTransaction(data.transactionType)} · {labelType(data.propertyType)}</span></div>
                    <small>{faDate(submission.createdAt)}</small>
                  </div>
                  <p>{String(data.neighborhood ?? "—")} · {String(data.areaM2 ?? "—")} متر · {priceText(data)}</p>
                  <div className="admin-customer-submission-owner"><strong>{submission.ownerName}</strong><a href={"tel:"+submission.ownerPhone}><Phone size={14}/>{submission.ownerPhone}</a><span dir="ltr">{submission.trackingToken}</span></div>
                  <div className="admin-customer-submission-actions">
                    <button type="button" className="btn-ghost" onClick={()=>setSelected(selectedOpen?null:submission)}>جزئیات و رسانه‌ها</button>
                    <button type="button" className="btn-gold" disabled={busyId===submission.id} onClick={()=>void act("approve",submission)}><CheckCircle2 size={15}/> تأیید و انتشار</button>
                    <button type="button" className="btn-ghost danger" disabled={busyId===submission.id} onClick={()=>void act("reject",submission)}><XCircle size={15}/> رد</button>
                  </div>
                </div>
              </div>
              {selectedOpen ? (
                <div className="admin-customer-submission-detail">
                  <div className="admin-customer-submission-detail-grid">
                    <div><span>آدرس</span><strong>{String(data.address || "ثبت نشده")}</strong></div>
                    <div><span>خواب / حمام</span><strong>{String(data.bedrooms ?? "—")} / {String(data.bathrooms ?? "—")}</strong></div>
                    <div><span>طبقه</span><strong>{String(data.floor ?? "—")} از {String(data.totalFloors ?? "—")}</strong></div>
                    <div><span>سال ساخت</span><strong>{String(data.builtYear ?? "—")}</strong></div>
                    <div className="wide"><span>توضیحات</span><p>{String(data.description ?? "—")}</p></div>
                  </div>
                  {media.length ? <div className="admin-customer-submission-media">{media.map((src)=><div key={src}>{/\.(mp4|webm|mov|m4v)(\?|$)/i.test(src)||src.toLowerCase().includes("/video/")?<video src={src} controls preload="metadata"/>:<img src={src} alt="" loading="lazy"/>}{isVideo(src)?<small><Film size={12}/> ویدئو</small>:null}</div>)}</div> : null}
                  <label className="field"><span>یادداشت بررسی (اختیاری)</span><textarea rows={3} value={reviewNote} onChange={(e)=>setReviewNote(e.target.value)} placeholder="مثلاً سند بررسی شد، قیمت نیاز به تأیید دارد…"/></label>
                  {submission.propertyId ? <a className="btn-ghost" href={"/properties/" + String(data.slug ?? "")} target="_blank" rel="noreferrer"><ExternalLink size={15}/> مشاهده فایل منتشرشده</a> : null}
                </div>
              ) : null}
            </article>
          );
        })}
       </div>}
    </section>
  );
}

function isVideo(src: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src) || src.toLowerCase().includes("/video/");
}
