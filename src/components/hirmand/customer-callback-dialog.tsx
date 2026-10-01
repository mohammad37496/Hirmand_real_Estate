import { PhoneCall, X, CheckCircle2, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { customerFetch } from "@/lib/customer-fetch";
import "@/customer-engagement.css";

export function CustomerCallbackDialog({propertyId,propertyTitle,compact=false}:{propertyId?:string;propertyTitle?:string;compact?:boolean}) {
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [preferredAt,setPreferredAt]=useState("");
  const [note,setNote]=useState("");
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);

  useEffect(()=>{if(!open){setDone(false);}},[open]);

  async function submit(){
    if(!/^09\d{9}$/.test(phone.trim())||name.trim().length<2){toast.error("نام و شماره موبایل معتبر وارد کنید.");return;}
    setSending(true);
    try{
      const response=await customerFetch("/api/callback-request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create",name:name.trim(),phone:phone.trim(),preferredAt:preferredAt||undefined,propertyId,propertyTitle,note:note.trim()})});
      const data=await response.json().catch(()=>null) as {statusMessage?:string;duplicate?:boolean};
      if(!response.ok) throw new Error(data?.statusMessage||"ثبت درخواست تماس انجام نشد.");
      setDone(true); toast.success(data?.duplicate?"درخواست قبلی شما هنوز در حال پیگیری است.":"درخواست تماس ثبت شد.");
    }catch(e){toast.error(e instanceof Error?e.message:"ثبت درخواست تماس انجام نشد.");}
    finally{setSending(false);}
  }

  return (
    <>
      <button type="button" className={compact?"btn-ghost customer-callback-trigger":"customer-engage-fab customer-callback-fab"} onClick={()=>setOpen(true)} aria-label="درخواست تماس">
        <PhoneCall size={18}/>{compact?<span>درخواست تماس</span>:null}
      </button>
      {open?(
        <div className="customer-modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(false);}}>
          <section className="customer-modal" role="dialog" aria-modal="true" aria-label="درخواست تماس با هیرمند">
            <header><div><span className="kicker">تماس از طرف هیرمند</span><h2>درخواست تماس</h2></div><button type="button" className="customer-mini-button" onClick={()=>setOpen(false)} aria-label="بستن"><X size={17}/></button></header>
            {done?(
              <div className="customer-success-state"><CheckCircle2 size={34}/><strong>درخواست شما ثبت شد</strong><p>درخواست در داشبورد مشتری ذخیره شد و تیم هیرمند آن را پیگیری می‌کند.</p><button type="button" className="btn-gold" onClick={()=>setOpen(false)}>بستن</button></div>
            ):(
              <div className="customer-form-stack">
                {propertyTitle?<div className="customer-context-chip">{propertyTitle}</div>:null}
                <label className="field"><span>نام</span><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="نام و نام خانوادگی"/></label>
                <label className="field"><span>موبایل</span><input inputMode="tel" dir="ltr" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/[^0-9]/g,"").slice(0,11))} placeholder="0912…"/></label>
                <label className="field"><span><CalendarClock size={14}/> زمان ترجیحی (اختیاری)</span><input type="datetime-local" value={preferredAt} onChange={(e)=>setPreferredAt(e.target.value)} min={new Date(Date.now()+30*60*1000).toISOString().slice(0,16)}/></label>
                <label className="field"><span>توضیح</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} rows={3} maxLength={1200} placeholder="مثلاً: برای همین فایل تماس بگیرید."/></label>
                <div className="customer-modal-actions"><button type="button" className="btn-ghost" onClick={()=>setOpen(false)}>انصراف</button><button type="button" className="btn-gold" onClick={()=>void submit()} disabled={sending}>{sending?"در حال ثبت…":"ثبت درخواست تماس"}</button></div>
              </div>
            )}
          </section>
        </div>
      ):null}
    </>
  );
}
