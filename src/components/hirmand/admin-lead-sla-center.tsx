import { Gauge, Phone, RefreshCw, TimerReset } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Lead={id:string;name:string;phone:string;consultant:string;deal:string;neighborhood:string;status:string;createdAt:string;firstContactAt:string|null;responseMinutes:number|null;breached:boolean};
type Consultant={consultant:string;active:number;responded:number;waiting:number;breached:number;avgResponseMinutes:number|null};

function fa(value:number){return value.toLocaleString("fa-IR")}
function duration(minutes:number|null){
  if(minutes==null)return "در انتظار پاسخ";
  if(minutes<60)return fa(minutes)+" دقیقه";
  return fa(Math.floor(minutes/60))+" ساعت و "+fa(minutes%60)+" دقیقه";
}

export function AdminLeadSlaCenter(){
 const [data,setData]=useState<{summary:{active:number;waiting:number;breached:number;responded:number;avgResponseMinutes:number|null};leads:Lead[];consultants:Consultant[]}|null>(null);
 const [threshold,setThreshold]=useState(120); const [days,setDays]=useState(30); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/admin-lead-sla",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({thresholdMinutes:threshold,days})});const d=await r.json() as typeof data & {statusMessage?:string};if(!r.ok)throw new Error(d?.statusMessage||"گزارش SLA بارگذاری نشد.");setData(d);}catch(e){toast.error(e instanceof Error?e.message:"گزارش SLA بارگذاری نشد.");}finally{setLoading(false);}},[threshold,days]);
 useEffect(()=>{void load()},[load]);
 const waiting=useMemo(()=>data?.leads.filter(x=>x.firstContactAt==null)??[],[data]);
 return <section className="admin-panel admin-sla-center">
  <div className="admin-panel-head"><div><span className="kicker">SLA مرکز تماس</span><h2>زمان پاسخ‌گویی به لیدها</h2></div><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> تازه‌سازی</button></div>
  <div className="admin-sla-controls"><label>حد هشدار<select value={threshold} onChange={e=>setThreshold(Number(e.target.value))}><option value={30}>۳۰ دقیقه</option><option value={60}>۱ ساعت</option><option value={120}>۲ ساعت</option><option value={240}>۴ ساعت</option><option value={1440}>۲۴ ساعت</option></select></label><label>بازه<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>۷ روز</option><option value={30}>۳۰ روز</option><option value={90}>۹۰ روز</option></select></label></div>
  <div className="admin-dashboard-mini-grid"><div><span>لیدهای فعال</span><strong>{fa(data?.summary.active||0)}</strong></div><div><span>منتظر تماس</span><strong>{fa(data?.summary.waiting||0)}</strong></div><div><span>عبور از SLA</span><strong>{fa(data?.summary.breached||0)}</strong></div><div><span>میانگین پاسخ</span><strong>{data?.summary.avgResponseMinutes==null?"—":duration(data.summary.avgResponseMinutes)}</strong></div></div>
  <div className="admin-sla-grid">
   <div><header><strong>صف منتظر پاسخ</strong><small>{fa(waiting.length)} مورد</small></header>{loading?<div className="admin-empty"><TimerReset size={24}/><strong>در حال محاسبه…</strong></div>:waiting.length?waiting.slice(0,12).map(x=><div className={"admin-sla-row"+(x.breached?" is-breached":"")} key={x.id}><div><strong>{x.name}</strong><small>{x.consultant||"بدون مشاور"} · {x.neighborhood||"بدون محله"}</small></div><span>{x.breached?"SLA رد شده":"در صف"} · {duration(Math.floor((Date.now()-new Date(x.createdAt).getTime())/60000))}</span><a href={"tel:"+x.phone} aria-label={"تماس با "+x.name}><Phone size={14}/></a></div>):<div className="admin-empty"><Gauge size={24}/><strong>صف انتظار خالی است.</strong></div>}</div>
   <div><header><strong>تفکیک مشاوران</strong><small>بر اساس {days} روز اخیر</small></header>{(data?.consultants||[]).map(c=><div className="admin-sla-consultant" key={c.consultant}><div><strong>{c.consultant}</strong><small>فعال: {fa(c.active)} · پاسخ‌داده: {fa(c.responded)}</small></div><span className={c.breached?"is-breached":""}>تجاوز SLA: {fa(c.breached)} · میانگین {c.avgResponseMinutes==null?"—":duration(c.avgResponseMinutes)}</span></div>)}</div>
  </div>
 </section>;
}
