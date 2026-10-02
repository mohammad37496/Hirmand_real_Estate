import { ArrowDownRight, ArrowUpLeft, BarChart3, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Item={id:string;propertyId:string;slug:string;title:string;neighborhood:string;transactionType:string;changedAt:string;oldValue:number|null;newValue:number|null;deltaPercent:number|null;direction:"same"|"down"|"up"};
function fa(value:number){return value.toLocaleString("fa-IR")}
function money(v:number|null){return v==null?"—":fa(Math.round(v))+" تومان"}
function typeLabel(v:string){return v==="rent"?"اجاره":v==="mortgage"?"رهن":v==="buy"?"خرید":"فروش"}

export function AdminPriceHistoryCenter(){
 const [data,setData]=useState<{items:Item[];summary:{changes:number;drops:number;increases:number}}|null>(null);
 const [days,setDays]=useState(90); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/admin-price-history?days="+days,{credentials:"same-origin"});const d=await r.json() as {items?:Item[];summary?:{changes:number;drops:number;increases:number};statusMessage?:string};if(!r.ok)throw new Error(d?.statusMessage||"تاریخچه قیمت بارگذاری نشد.");setData({items:Array.isArray(d.items)?d.items:[],summary:d.summary||{changes:0,drops:0,increases:0}});}catch(e){toast.error(e instanceof Error?e.message:"تاریخچه قیمت بارگذاری نشد.");}finally{setLoading(false);}},[days]);
 useEffect(()=>{void load()},[load]);
 return <section className="admin-panel admin-price-history">
  <div className="admin-panel-head"><div><span className="kicker">تحلیل قیمت</span><h2>تاریخچه تغییر قیمت و شرایط</h2></div><div style={{display:"flex",gap:8,alignItems:"center"}}><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>۳۰ روز</option><option value={90}>۹۰ روز</option><option value={180}>۱۸۰ روز</option><option value={365}>یک سال</option></select><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> تازه‌سازی</button></div></div>
  <div className="admin-dashboard-mini-grid"><div><span>تغییرات</span><strong>{fa(data?.summary.changes||0)}</strong></div><div><span>کاهش</span><strong>{fa(data?.summary.drops||0)}</strong></div><div><span>افزایش</span><strong>{fa(data?.summary.increases||0)}</strong></div></div>
  <div className="admin-price-list">
   {loading?<div className="admin-empty"><BarChart3 size={24}/><strong>در حال بارگذاری تاریخچه…</strong></div>:!data?.items.length?<div className="admin-empty"><BarChart3 size={24}/><strong>در این بازه تغییر قیمتی ثبت نشده است.</strong></div>:data.items.map(x=><article className="admin-price-row" key={x.id}>
    <div className="admin-price-icon" data-direction={x.direction}>{x.direction==="down"?<ArrowDownRight size={17}/>:<ArrowUpLeft size={17}/>}</div>
    <div className="admin-price-main"><div><strong>{x.title}</strong><span>{typeLabel(x.transactionType)}</span></div><small>{x.neighborhood||"بدون محله"} · {new Date(x.changedAt).toLocaleDateString("fa-IR")}</small></div>
    <div className="admin-price-values"><span>{money(x.oldValue)}</span><b>←</b><strong>{money(x.newValue)}</strong><em data-direction={x.direction}>{x.deltaPercent==null?"":(x.deltaPercent>0?"+":"")+x.deltaPercent+"٪"}</em></div>
    <a className="btn-ghost" href={"/properties/"+x.slug} target="_blank" rel="noreferrer"><ExternalLink size={14}/> فایل</a>
   </article>)}
  </div>
 </section>;
}
