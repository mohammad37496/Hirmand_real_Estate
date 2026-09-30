import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, ExternalLink, Phone, RefreshCw, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/components/hirmand/admin-ui-utils";

type Item={id:string;name:string;phone:string;status:string;consultant:string;deal:string;neighborhood:string;followUpAt:string|null;visitPreferredAt:string|null;visitStatus:string;propertySlug:string|null;propertyTitle:string;priority:"urgent"|"high"|"normal";nextAction:string};
type Data={generatedAt:string;stats:{overdue:number;today:number;newLeads:number;upcomingVisits:number;unassigned:number};queues:Record<string,Item[]>};
const STATUS_LABEL:Record<string,string>={new:"جدید",contacted:"تماس",follow_up:"پیگیری",visited:"بازدید",contract:"قرارداد"};
const QUEUES:Array<[string,string]>=[["overdue","پیگیری عقب‌افتاده"],["today","پیگیری‌های امروز"],["newLeads","لیدهای جدید"],["upcomingVisits","بازدیدهای نزدیک"],["unassigned","بدون مشاور"]];
const CSS=[
".alc{display:grid;gap:14px;margin-bottom:18px}",".alc-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}",".alc-stat{padding:13px 14px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);box-shadow:var(--el-1)}",".alc-stat[data-tone='danger']{background:var(--danger-bg);border-color:rgb(163 49 39 / 25%)}",".alc-stat[data-tone='gold']{background:var(--brass-100);border-color:var(--brass-300)}",".alc-stat small{display:block;color:var(--muted);font-size:.68rem}.alc-stat strong{display:block;margin-top:5px;color:var(--navy-900);font-size:1.2rem;font-variant-numeric:tabular-nums}",
".alc-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.alc-head h2{margin:0;color:var(--navy-900);font-size:1rem}.alc-head p{margin:3px 0 0;color:var(--muted);font-size:.69rem}",".alc-queues{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}",".alc-queue{min-width:0}.alc-queue-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.alc-queue-title strong{font-size:.76rem;color:var(--navy-900)}",".alc-queue-list{display:grid;gap:7px}.alc-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--card)}",".alc-row[data-priority='urgent']{border-color:rgb(163 49 39 / 28%);background:var(--danger-bg)}.alc-row-main{min-width:0}.alc-row-main strong{display:block;color:var(--navy-900);font-size:.74rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",".alc-row-main small{display:block;color:var(--subtle);font-size:.63rem;margin-top:2px}.alc-next{display:inline-flex;margin-top:5px;padding:3px 6px;border-radius:999px;background:var(--card-2);border:1px solid var(--line);color:var(--brass-700);font-size:.61rem}",".alc-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.alc-actions a,.alc-actions button{min-height:30px;padding:6px 8px;border-radius:8px;font-size:.62rem}.alc-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card-2);color:var(--navy-900)}",".alc-empty{padding:16px;text-align:center;border:1px dashed var(--line-2);border-radius:10px;color:var(--subtle);font-size:.68rem}","@media(max-width:1100px){.alc-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.alc-queues{grid-template-columns:1fr 1fr}}","@media(max-width:680px){.alc-stats{grid-template-columns:1fr 1fr}.alc-queues{grid-template-columns:1fr}.alc-row{grid-template-columns:minmax(0,1fr)}}","@media(max-width:420px){.alc-stats{grid-template-columns:1fr}}"
].join("\\n");
function dateLabel(value:string|null){return value?new Date(value).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"}):"بدون موعد";}
function digits(value:string){return value.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\\D/g,"");}
export function AdminLeadCommandCenter(){
  const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  const load=useCallback(async()=>{setLoading(true);try{const res=await fetch("/api/admin-lead-command",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"summary"})});const body=await res.json().catch(()=>({})) as Data&{statusMessage?:string};if(!res.ok)throw new Error(body.statusMessage||"مرکز فرمان لیدها بارگذاری نشد.");setData(body);}catch(e){toast.error(adminErrorMessage(e,"مرکز فرمان لیدها بارگذاری نشد."));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function action(id:string,actionName:"status"|"follow_up"|"assign"|"create_task",payload:Record<string,unknown>={}){if(busy)return;setBusy(id+actionName);try{const res=await fetch("/api/admin-lead-command",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:actionName,id,...payload})});const body=await res.json().catch(()=>({})) as {statusMessage?:string};if(!res.ok)throw new Error(body.statusMessage||"عملیات انجام نشد.");await load();toast.success("عملیات انجام شد.");}catch(e){toast.error(adminErrorMessage(e,"عملیات انجام نشد."));}finally{setBusy("");}}
  if(!data&&loading)return <section className="admin-panel alc"><style>{CSS}</style><div className="admin-empty">در حال آماده‌سازی مرکز فرمان لیدها…</div></section>;
  return <section className="admin-panel alc"><style>{CSS}</style>
    <div className="alc-head"><div><span className="kicker">Lead Command Center</span><h2>مرکز فرمان لیدها</h2><p>صف اجرایی تماس، پیگیری، بازدید و لیدهای بدون مسئول.</p></div><button type="button" className="btn-ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?"admin-spin":undefined}/>به‌روزرسانی</button></div>
    <div className="alc-stats">
      <div className="alc-stat" data-tone={data?.stats.overdue?"danger":undefined}><small>عقب‌افتاده</small><strong>{data?.stats.overdue.toLocaleString("fa-IR")}</strong></div>
      <div className="alc-stat" data-tone="gold"><small>امروز</small><strong>{data?.stats.today.toLocaleString("fa-IR")}</strong></div>
      <div className="alc-stat"><small>لید جدید</small><strong>{data?.stats.newLeads.toLocaleString("fa-IR")}</strong></div>
      <div className="alc-stat"><small>بازدید نزدیک</small><strong>{data?.stats.upcomingVisits.toLocaleString("fa-IR")}</strong></div>
      <div className="alc-stat"><small>بدون مشاور</small><strong>{data?.stats.unassigned.toLocaleString("fa-IR")}</strong></div>
    </div>
    <div className="alc-queues">{QUEUES.slice(0,4).map(([key,label])=>{const items=data?.queues[key]??[];return <div className="alc-queue" key={key}>
      <div className="alc-queue-title"><strong>{label}</strong><span className="admin-dashboard-summary">{items.length.toLocaleString("fa-IR")}</span></div>
      {items.length?<div className="alc-queue-list">{items.slice(0,6).map(item=><article className="alc-row" data-priority={item.priority} key={item.id}>
        <span className="alc-icon">{item.priority==="urgent"?<XCircle size={15}/>:<Clock3 size={15}/>}</span>
        <div className="alc-row-main"><strong>{item.name||"بدون نام"}</strong><small>{item.phone} · {STATUS_LABEL[item.status]??item.status}{item.consultant?" · "+item.consultant:" · بدون مشاور"}</small><span className="alc-next">{item.nextAction}</span><small>{key==="overdue"||key==="today"?dateLabel(item.followUpAt):item.visitPreferredAt?dateLabel(item.visitPreferredAt):item.neighborhood||"بدون محله"}</small>
          <div className="alc-actions"><a className="btn-ghost" href={"tel:"+digits(item.phone)}><Phone size={13}/>تماس</a><button className="btn-ghost" type="button" onClick={()=>void action(item.id,"status",{status:"contacted"})} disabled={Boolean(busy)}><CheckCircle2 size={13}/>تماس شد</button>
            {item.status==="new"?<button className="btn-ghost" type="button" onClick={()=>void action(item.id,"follow_up",{followUpAt:new Date(Date.now()+30*60*1000).toISOString()})} disabled={Boolean(busy)}><CalendarClock size={13}/>۳۰ دقیقه</button>:null}
            {item.propertySlug?<a className="btn-ghost" href={"/properties/"+encodeURIComponent(item.propertySlug)} target="_blank" rel="noreferrer"><ExternalLink size={12}/>ملک</a>:null}
          </div>
        </div>
      </article>)}</div>:<div className="alc-empty">موردی در این صف نیست.</div>}
    </div>})}</div>
  </section>;
}
