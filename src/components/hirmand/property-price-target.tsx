import { BellRing, Target, X, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { customerFetch } from "@/lib/customer-fetch";
import { formatToman } from "@/lib/money";
import "@/property-price-target.css";

export function PropertyPriceTarget({
  slug,
  transactionType,
  currentPrice,
  currentDeposit,
}: {
  slug: string;
  transactionType: string;
  currentPrice: number | null;
  currentDeposit: number | null;
}) {
  const [open,setOpen]=useState(false);
  const [target,setTarget]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);

  const current = transactionType === "rent" || transactionType === "mortgage" ? currentDeposit : currentPrice;
  const label = transactionType === "rent" || transactionType === "mortgage" ? "سقف رهن هدف" : "سقف قیمت هدف";

  async function save(){
    const digits=target.replace(/,/g,"").replace(/[^0-9]/g,"");
    const value=Number(digits);
    if(!Number.isFinite(value)||value<=0){toast.error("یک مبلغ معتبر وارد کنید.");return;}
    setBusy(true);
    try{
      const response=await customerFetch("/api/property-watch",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"subscribe",slug,targetPrice:value}),
      });
      const data=await response.json().catch(()=>null) as {statusMessage?:string};
      if(!response.ok) throw new Error(data?.statusMessage||"هشدار قیمت هدف ذخیره نشد.");
      setDone(true);
      toast.success("هشدار قیمت هدف ذخیره شد.");
    }catch(e){toast.error(e instanceof Error?e.message:"ذخیره هشدار انجام نشد.");}
    finally{setBusy(false);}
  }

  return (
    <>
      <button type="button" className="property-target-button" onClick={()=>{setDone(false);setOpen(true);}} aria-label="تنظیم هشدار قیمت هدف">
        <Target size={16} aria-hidden="true"/><span>هشدار قیمت هدف</span>
      </button>
      {open?(
        <div className="property-target-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(false);}}>
          <section className="property-target-modal" role="dialog" aria-modal="true" aria-label="هشدار قیمت هدف">
            <header>
              <div><span className="kicker"><BellRing size={13}/> اعلان هوشمند</span><h2>قیمت هدف این فایل</h2></div>
              <button type="button" className="property-target-close" onClick={()=>setOpen(false)} aria-label="بستن"><X size={17}/></button>
            </header>
            {done?(
              <div className="property-target-done">
                <CheckCircle2 size={34}/><strong>هشدار ثبت شد</strong>
                <p>وقتی قیمت فایل به محدودهٔ هدف شما برسد، در مرکز اعلان‌ها اطلاع می‌گیری.</p>
                <button type="button" className="btn-gold" onClick={()=>setOpen(false)}>باشه</button>
              </div>
            ):(
              <div className="property-target-form">
                {current!=null?<div className="property-target-current">قیمت فعلی: <strong>{formatToman(current)} تومان</strong></div>:null}
                <label className="field">
                  <span>{label}</span>
                  <input dir="ltr" inputMode="numeric" value={target} onChange={(e)=>setTarget(e.target.value.replace(/[^0-9,]/g,""))} placeholder="مثلاً ۵۰۰۰۰۰۰۰۰" autoFocus/>
                </label>
                <p>با رسیدن مبلغ فایل به این عدد یا کمتر، هشدار قیمت برای حساب شما فعال می‌شود.</p>
                <div className="property-target-actions">
                  <button type="button" className="btn-ghost" onClick={()=>setOpen(false)}>انصراف</button>
                  <button type="button" className="btn-gold" onClick={()=>void save()} disabled={busy}>{busy?"در حال ذخیره…":"ذخیره هشدار"}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ):null}
    </>
  );
}
