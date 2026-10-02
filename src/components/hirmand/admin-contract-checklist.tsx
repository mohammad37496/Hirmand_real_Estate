import { CheckSquare, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Item={key:string;label:string};
type Task={key:string|null;title:string;done:boolean;updatedAt:string|null};
type Contract={id:string;name:string;phone:string;consultant:string;deal:string;neighborhood:string;propertySlug:string|null;propertyTitle:string|null;tasks:Task[]};
const fallback=["احراز هویت خریدار / مستأجر","احراز هویت مالک / موجر","بررسی سند و مدارک ملک","استعلام‌ها و بررسی‌های لازم","ثبت مبلغ و شرایط نهایی","پیش‌نویس قرارداد","ثبت و تسویه کمیسیون","تحویل / تسویه نهایی"];
function fa(v:number){return v.toLocaleString("fa-IR")}

export function AdminContractChecklist(){
 const [items,setItems]=useState<Item[]>([]); const [contracts,setContracts]=useState<Contract[]>([]); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/admin-contract-checklist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list"})});const d=await r.json() as {items?:Item[];contracts?:Contract[];statusMessage?:string};if(!r.ok)throw new Error(d.statusMessage||"چک‌لیست قرارداد بارگذاری نشد.");setItems(Array.isArray(d.items)?d.items:[]);setContracts(Array.isArray(d.contracts)?d.contracts:[]);}catch(e){toast.error(e instanceof Error?e.message:"چک‌لیست قرارداد بارگذاری نشد.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load()},[load]);
 const labels=items.length?items:fallback.map((label,i)=>({key:String(i),label}));
 function doneSet(contract:Contract){return new Set(contract.tasks.filter(x=>x.done).map(x=>x.key))}
 function isDone(contract:Contract,key:string){return doneSet(contract).has(key)}
 function progress(contract:Contract){const s=doneSet(contract);return Math.round(s.size/Math.max(1,labels.length)*100)}
 async function toggle(leadId:string,key:string,done:boolean){if(busy)return;setBusy(leadId+"|"+key);try{const r=await fetch("/api/admin-contract-checklist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"toggle",leadId,itemKey:key,done})});if(!r.ok)throw new Error("تغییر چک‌لیست ذخیره نشد.");setContracts(prev=>prev.map(c=>c.id===leadId?{...c,tasks:[...c.tasks.filter(t=>t.key!==key),{key,title:labels.find(i=>i.key===key)?.label||key,done,updatedAt:new Date().toISOString()}]}:c));}catch(e){toast.error(e instanceof Error?e.message:"ذخیره چک‌لیست انجام نشد.");}finally{setBusy(null)}}
 return <section className="admin-panel admin-contract-checklist">
  <div className="admin-panel-head"><div><span className="kicker">کنترل قرارداد</span><h2>چک‌لیست معامله و مدارک</h2></div><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> تازه‌سازی</button></div>
  {loading?<div className="admin-empty"><CheckSquare size={24}/><strong>در حال بارگذاری قراردادها…</strong></div>:!contracts.length?<div className="admin-empty"><CheckSquare size={24}/><strong>هنوز قراردادی در وضعیت «قرارداد» وجود ندارد.</strong></div>:<div className="admin-contract-grid">{contracts.map(c=><article className="admin-contract-card" key={c.id}>
   <header><div><strong>{c.name}</strong><small>{c.consultant||"بدون مشاور"} · {c.deal||"قرارداد"}</small></div><b>{fa(progress(c))}٪</b></header>
   {c.propertyTitle?<p><span>{c.propertyTitle}</span> · {c.neighborhood||"بدون محله"}</p>:null}
   <div className="admin-contract-progress"><span style={{width:progress(c)+"%"}}/></div>
   <div className="admin-contract-checks">{labels.map(item=>{const checked=isDone(c,item.key);return <label key={item.key} className={checked?"is-done":""}><input type="checkbox" checked={checked} onChange={e=>void toggle(c.id,item.key,e.target.checked)}/><span>{item.label}</span></label>})}</div>
   {c.propertySlug?<a className="btn-ghost" href={"/properties/"+c.propertySlug} target="_blank" rel="noreferrer"><ExternalLink size={14}/> مشاهده فایل</a>:null}
  </article>)}</div>}
 </section>;
}
