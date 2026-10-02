import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, GripVertical, Phone, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/components/hirmand/admin-ui-utils";

type Status = "new"|"contacted"|"follow_up"|"visited"|"contract"|"closed";
type Lead = {
  id:string; name:string; phone:string; deal:string; propertyType:string; neighborhood:string;
  consultant:string; status:Status|"spam"; followUpAt:string|null; visitPreferredAt:string|null;
};
const COLS:{key:Status;label:string}[]=[
  {key:"new",label:"جدید"},{key:"contacted",label:"تماس گرفته شد"},{key:"follow_up",label:"پیگیری"},
  {key:"visited",label:"بازدید"},{key:"contract",label:"قرارداد"},{key:"closed",label:"بسته‌شده"},
];
const labelDeal=(v:string)=>v==="sell"||v.includes("فروش")?"فروش":v==="buy"||v.includes("خرید")?"خرید":v==="rent"||v.includes("اجاره")?"اجاره":v==="mortgage"||v.includes("رهن")?"رهن":v||"درخواست";
const fa=(v:number)=>v.toLocaleString("fa-IR");
const dateFa=(v:string|null)=>v?new Intl.DateTimeFormat("fa-IR",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date(v)):"—";

export function AdminLeadKanban(){
  const[leads,setLeads]=useState<Lead[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/leads-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",limit:100,offset:0,sort:"follow_up"})});const d=await r.json().catch(()=>({})) as {leads?:Lead[];statusMessage?:string};if(!r.ok)throw new Error(d.statusMessage||"برد CRM بارگذاری نشد.");setLeads(Array.isArray(d.leads)?d.leads.filter(x=>x.status!=="spam"):[]);}catch(e){toast.error(adminErrorMessage(e,"برد CRM بارگذاری نشد."));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function move(id:string,status:Status){if(busy)return;const prev=leads;setBusy(id);setLeads(x=>x.map(l=>l.id===id?{...l,status}:l));try{const r=await fetch("/api/leads-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"status",id,status})});if(!r.ok){const d=await r.json().catch(()=>({})) as {statusMessage?:string};throw new Error(d.statusMessage||"تغییر وضعیت انجام نشد.");}}catch(e){setLeads(prev);toast.error(adminErrorMessage(e,"تغییر وضعیت انجام نشد."));}finally{setBusy("");}}
  const grouped=useMemo(()=>Object.fromEntries(COLS.map(c=>[c.key,leads.filter(l=>l.status===c.key)])) as Record<Status,Lead[]>,[leads]);
  return <section className="admin-panel" aria-label="برد کانبان CRM">
    <div className="admin-panel-head"><div><span className="kicker">CRM عملیاتی</span><h2>برد کانبان درخواست‌های مشتری</h2><p>جابه‌جایی لید بین مراحل فروش با Drag & Drop یا انتخابگر وضعیت.</p></div><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> بروزرسانی</button></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}><span className="admin-lead-status"><UsersRound size={13}/> {fa(leads.length)} لید</span><span className="admin-lead-status"><Clock3 size={13}/> {fa(leads.filter(x=>x.followUpAt&&new Date(x.followUpAt).getTime()<Date.now()&&!["contract","closed"].includes(x.status)).length)} معوق</span><span className="admin-lead-status"><CheckCircle2 size={13}/> {fa(grouped.contract.length)} قرارداد</span></div>
    {loading?<div className="admin-empty"><RefreshCw size={22} className="admin-spin"/> در حال دریافت…</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(205px,1fr))",gap:8,overflowX:"auto",paddingBottom:4}}>
      {COLS.map(col=><section key={col.key} style={{minHeight:400,border:"1px solid var(--line)",borderRadius:14,background:"var(--surface-2,#f7f5f0)"}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");if(id)void move(id,col.key);}}>
        <div style={{padding:"10px 11px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",gap:8}}><strong style={{color:"var(--navy-900)",fontSize:".72rem"}}>{col.label}</strong><span className="admin-lead-status">{fa(grouped[col.key].length)}</span></div>
        <div style={{display:"grid",gap:7,padding:8}}>
          {grouped[col.key].length===0?<div className="admin-empty">خالی</div>:grouped[col.key].map(lead=><article key={lead.id} draggable={busy!==lead.id} onDragStart={e=>e.dataTransfer.setData("text/plain",lead.id)} style={{display:"grid",gap:7,padding:9,border:"1px solid var(--line)",borderRadius:11,background:"var(--card,#fff)",opacity:busy===lead.id?0.58:1}}>
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}><GripVertical size={14}/><div><strong>{lead.name||"مشتری بدون نام"}</strong><small style={{display:"block",color:"var(--subtle)"}}>{lead.phone}</small></div></div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}><span className="admin-lead-status">{labelDeal(lead.deal)}</span>{lead.propertyType?<span className="admin-lead-status">{lead.propertyType}</span>:null}{lead.neighborhood?<span className="admin-lead-status">{lead.neighborhood}</span>:null}</div>
            <small style={{color:"var(--muted)"}}>{lead.consultant?"مشاور: "+lead.consultant:"بدون مشاور"}{lead.followUpAt?" · پیگیری: "+dateFa(lead.followUpAt):""}</small>
            <div style={{display:"flex",gap:5}}><select value={lead.status} disabled={busy===lead.id} onChange={e=>void move(lead.id,e.target.value as Status)} style={{flex:1,minWidth:0}} aria-label={"وضعیت "+lead.name}>{COLS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select>{lead.phone?<a className="admin-icon-btn" href={"tel:"+lead.phone} title="تماس"><Phone size={14}/></a>:null}</div>
          </article>)}
        </div>
      </section>)}
    </div>}
  </section>;
}
