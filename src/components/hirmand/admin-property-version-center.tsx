import { useCallback,useEffect,useMemo,useState } from "react";
import { ChevronDown, History, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Snapshot=Record<string,unknown>;
type Row={id:number;propertyId:string;propertyTitle:string;slug:string;changedAt:string;changedFields:string[];before:Snapshot;after:Snapshot};
const fa=(n:number)=>n.toLocaleString("fa-IR");
const date=(v:string)=>{try{return new Intl.DateTimeFormat("fa-IR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return v;}};

export function AdminPropertyVersionCenter(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<number|null>(null),[expanded,setExpanded]=useState<number|null>(null),[query,setQuery]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{const res=await fetch("/api/admin-property-versions",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"list",limit:60})});const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d?.statusMessage||"تاریخچه نسخه‌های فایل دریافت نشد.");setRows(Array.isArray(d.rows)?d.rows:[]);}catch(e){toast.error(e instanceof Error?e.message:"تاریخچه نسخه‌ها دریافت نشد.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function restore(row:Row){if(busy!==null)return;if(!window.confirm("این نسخه روی فایل فعلی اعمال شود؟ یک رکورد جدید از بازگردانی نیز در تاریخچه ثبت خواهد شد."))return;setBusy(row.id);try{const res=await fetch("/api/admin-property-versions",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"restore",propertyId:row.propertyId,historyId:row.id})});const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d?.statusMessage||"بازگردانی نسخه انجام نشد.");toast.success("نسخه فایل بازگردانی شد.");await load();}catch(e){toast.error(e instanceof Error?e.message:"بازگردانی نسخه انجام نشد.");}finally{setBusy(null);}}
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return q?rows.filter(r=>r.propertyTitle.toLocaleLowerCase().includes(q)||r.propertyId.toLocaleLowerCase().includes(q)):rows;},[query,rows]);
 return <main className="admin-property-version-page">
  <section className="admin-panel"><div className="admin-panel-head"><div><span className="kicker">کنترل نسخه</span><h2>تاریخچه تغییرات و بازگردانی فایل</h2><p className="admin-property-version-lede">نسخه‌های ثبت‌شده اطلاعات اصلی فایل را ببینید و در صورت خطای ویرایش، همان snapshot را دوباره اعمال کنید.</p></div><button type="button" className="btn-ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?"admin-spin":""}/>بروزرسانی</button></div>
   <div className="admin-property-version-toolbar"><label className="admin-search"><History size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی نام فایل یا شناسه..." /></label><span className="admin-results-meta">{fa(filtered.length)} نسخه</span></div>
   {loading&&!rows.length?<div className="admin-empty"><RefreshCw size={22} className="admin-spin"/><strong>در حال دریافت نسخه‌ها…</strong></div>:!filtered.length?<div className="admin-empty"><History size={25}/><strong>نسخه‌ای پیدا نشد.</strong><p>تغییرات جدید فایل‌ها بعد از ویرایش در این مرکز ظاهر می‌شوند.</p></div>:
   <div className="admin-property-version-list">{filtered.map(row=>{const open=expanded===row.id;return <article className="admin-property-version-row" key={row.id}>
     <div className="admin-property-version-main"><div className="admin-property-version-title"><History size={16}/><strong>{row.propertyTitle}</strong><span>{date(row.changedAt)}</span></div><div className="admin-property-version-meta"><span>{row.changedFields.length?row.changedFields.join(" · "):"اطلاعات اصلی"}</span><span>نسخه #{fa(row.id)}</span></div>
      <div className="admin-property-version-actions"><Link className="btn-ghost" to="/properties/$slug" params={{slug:row.slug}} target="_blank">مشاهده فایل</Link><button type="button" className="btn-ghost" onClick={()=>setExpanded(open?null:row.id)}><ChevronDown size={15}/>مقایسه</button><button type="button" className="btn-gold" disabled={busy!==null} onClick={()=>void restore(row)}><RotateCcw size={15}/>{busy===row.id?"در حال بازگردانی…":"بازگردانی این نسخه"}</button></div>
     </div>
     {open?<div className="admin-property-version-diff"><div><h3>قبل از تغییر</h3><pre>{JSON.stringify(row.before,null,2)}</pre></div><div><h3>محتوای این نسخه</h3><pre>{JSON.stringify(row.after,null,2)}</pre></div></div>:null}
   </article>})}</div>}
  </section>
  <section className="admin-panel admin-property-version-safety"><ShieldCheck size={18}/><div><strong>بازگردانی قابل پیگیری است.</strong><p>رکورد قبلی حذف نمی‌شود؛ بازگردانی به‌عنوان یک تغییر جدید در تاریخچه و گزارش فعالیت ثبت می‌شود.</p></div></section>
 </main>;
}
