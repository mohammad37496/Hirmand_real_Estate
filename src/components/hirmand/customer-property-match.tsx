import { CheckCircle2, Target } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { customerFetch } from "@/lib/customer-fetch";
import "@/customer-property-match.css";

type MatchResponse = { enabled?: boolean; score?: number|null; reasons?: string[]; missingMustHave?: string[] };

export function CustomerPropertyMatch({ slug }: { slug: string }) {
  const [data,setData]=useState<MatchResponse|null>(null);
  useEffect(()=>{
    let active=true;
    void customerFetch("/api/customer-property-match?slug="+encodeURIComponent(slug),{credentials:"same-origin",cache:"no-store"})
      .then(async response=>{
        const next=await response.json().catch(()=>null) as MatchResponse|null;
        if(active&&response.ok&&next?.enabled)setData(next);
      }).catch(()=>{});
    return()=>{active=false;};
  },[slug]);
  if(data?.score==null)return null;
  return <aside className="customer-property-match" aria-label="امتیاز تطابق فایل با نیاز شما">
    <div className="customer-property-match-top">
      <div><span className="kicker"><Target size={13}/> تطابق هوشمند</span><strong>{data.score.toLocaleString("fa-IR")}٪</strong></div>
      <div className="customer-property-match-ring" style={{"--match":data.score} as CSSProperties}><span>{data.score.toLocaleString("fa-IR")}٪</span></div>
    </div>
    <div className="customer-property-match-reasons">
      {(data.reasons??[]).slice(0,4).map(reason=><span key={reason}><CheckCircle2 size={13}/>{reason}</span>)}
    </div>
    {data.missingMustHave?.length ? <small className="customer-property-match-missing">برخی امکانات ضروری انتخاب‌شده در این فایل ثبت نشده‌اند.</small> : null}
  </aside>;
}