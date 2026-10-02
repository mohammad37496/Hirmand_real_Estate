import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, CircleDollarSign, FileText, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { calculateBuy, calculateRent } from "@/lib/commission";
import { formatToman } from "@/lib/money";
import { adminErrorMessage } from "@/components/hirmand/admin-ui-utils";

type Lead={id:string;name:string;phone:string;deal:string;neighborhood:string;consultant:string;propertyId:string|null;offerAmount:number|null;offerConditions:string|null;budgetDeposit:number|null;budgetRent:number|null;budgetPurchase:number|null;budgetSale:number|null};
type Tx={id:number;kind:"income"|"expense";category:string;leadId:string|null;propertyId:string|null;amount:number};

function estimate(l:Lead){const k=l.deal.toLowerCase();return k==="rent"||k==="mortgage"||k.includes("رهن")||k.includes("اجاره")?calculateRent(l.budgetRent??0,l.budgetDeposit??0):calculateBuy(l.offerAmount??l.budgetSale??l.budgetPurchase??0);}
function dealLabel(v:string){return v==="sell"||v.includes("فروش")?"فروش":v==="buy"||v.includes("خرید")?"خرید":v==="rent"||v.includes("اجاره")?"اجاره":v==="mortgage"||v.includes("رهن")?"رهن":v||"معامله";}
const money=(n:number|null|undefined)=>n&&n>0?formatToman(n):"ثبت نشده";

export function AdminContractCenter(){
 const[leads,setLeads]=useState<Lead[]>([]),[tx,setTx]=useState<Tx[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{const[a,b]=await Promise.all([
   fetch("/api/leads-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",status:"contract",limit:100,offset:0,sort:"newest"})}),
   fetch("/api/admin-finance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",limit:200})})
 ]);const ad=await a.json().catch(()=>({})) as {leads?:Lead[];statusMessage?:string};const bd=await b.json().catch(()=>({})) as {transactions?:Tx[];statusMessage?:string};if(!a.ok)throw new Error(ad.statusMessage||"قراردادها دریافت نشد.");if(!b.ok)throw new Error(bd.statusMessage||"دفتر مالی دریافت نشد.");setLeads(Array.isArray(ad.leads)?ad.leads:[]);setTx(Array.isArray(bd.transactions)?bd.transactions:[]);}catch(e){toast.error(adminErrorMessage(e,"مرکز قرارداد بارگذاری نشد."));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load()},[load]);
 const summary=useMemo(()=>{let estimateSum=0,registered=0;for(const l of leads){const r=estimate(l);if(r)estimateSum+=r.total;if(tx.some(t=>t.kind==="income"&&t.category==="کمیسیون قرارداد"&&t.leadId===l.id))registered++;}return{estimateSum,registered}},[leads,tx]);
 async function register(l:Lead){if(busy)return;const r=estimate(l);if(!r){toast.error("مبلغ کافی برای محاسبه کمیسیون این قرارداد ثبت نشده.");return;}setBusy(l.id);try{const res=await fetch("/api/admin-finance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"create",kind:"income",title:"کمیسیون قرارداد · "+(l.name||"مشتری"),amount:Math.round(r.total),transactionDate:new Date().toISOString().slice(0,10),propertyId:l.propertyId,leadId:l.id,consultant:l.consultant,category:"کمیسیون قرارداد",note:"ثبت خودکار از مرکز قرارداد · "+dealLabel(l.deal)+(l.offerConditions?" · "+l.offerConditions:"")})});const d=await res.json().catch(()=>({})) as {statusMessage?:string};if(!res.ok)throw new Error(d.statusMessage||"ثبت کمیسیون انجام نشد.");toast.success("کمیسیون در دفتر مالی ثبت شد.");await load();}catch(e){toast.error(adminErrorMessage(e,"ثبت کمیسیون انجام نشد."));}finally{setBusy("");}}
 const registered=(l:Lead)=>tx.some(t=>t.kind==="income"&&t.category==="کمیسیون قرارداد"&&t.leadId===l.id);
 return <section className="admin-panel" aria-label="مرکز قرارداد و کمیسیون">
  <div className="admin-panel-head"><div><span className="kicker">معاملات</span><h2>مرکز قرارداد و کمیسیون</h2><p>قراردادهای CRM را با برآورد کمیسیون و ثبت درآمد در دفتر مالی یکجا مدیریت کنید.</p></div><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> بروزرسانی</button></div>
  <div className="admin-dashboard-mini-grid"><div><span><FileText size={13}/> قراردادها</span><strong>{leads.length.toLocaleString("fa-IR")}</strong></div><div><span><Calculator size={13}/> کمیسیون برآوردی</span><strong>{formatToman(summary.estimateSum)} تومان</strong></div><div><span><WalletCards size={13}/> کمیسیون ثبت‌شده</span><strong>{summary.registered.toLocaleString("fa-IR")}</strong></div></div>
  {loading?<div className="admin-empty"><RefreshCw size={23} className="admin-spin"/> در حال دریافت…</div>:!leads.length?<div className="admin-empty"><CircleDollarSign size={28}/><strong>هنوز قراردادی در CRM ثبت نشده.</strong></div>:<div style={{display:"grid",gap:9}}>
   {leads.map(l=>{const r=estimate(l),done=registered(l);return <article key={l.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,padding:13,border:"1px solid var(--line)",borderRadius:13,background:"var(--card,#fff)"}}>
    <div style={{display:"grid",gap:6,minWidth:0}}><div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}><strong style={{color:"var(--navy-900)"}}>{l.name||"مشتری بدون نام"}</strong><span className="admin-lead-status">{dealLabel(l.deal)}</span><span className="admin-lead-status">{done?"کمیسیون ثبت شده":"نیازمند ثبت"}</span></div><small style={{color:"var(--muted)"}}>{l.phone}{l.consultant?" · "+l.consultant:""}{l.neighborhood?" · "+l.neighborhood:""}{l.propertyId?" · فایل "+l.propertyId:""}</small><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}><div className="admin-stat-card"><span>مبلغ/معادل</span><strong>{r?.kind==="buy"?money(r.amount):r?.kind==="rent"?money(r.monthlyEq):"ثبت نشده"}</strong></div><div className="admin-stat-card"><span>کمیسیون کل</span><strong>{r?money(r.total):"ثبت نشده"}</strong></div><div className="admin-stat-card"><span>سهم هر طرف</span><strong>{r?money(r.each):"ثبت نشده"}</strong></div></div>{l.offerConditions?<small style={{color:"var(--muted)"}}>شرایط پیشنهاد: {l.offerConditions}</small>:null}</div>
    <div style={{display:"grid",alignContent:"center",gap:7,minWidth:155}}>{done?<div className="admin-lead-status"><CheckCircle2 size={14}/> درآمد ثبت شده</div>:<button className="btn-gold" type="button" onClick={()=>void register(l)} disabled={busy===l.id||!r}>{busy===l.id?"در حال ثبت…":"ثبت کمیسیون در دفتر مالی"}</button>}</div>
   </article>})}
  </div>}
 </section>;
}