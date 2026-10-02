import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Phone, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/components/hirmand/admin-ui-utils";

type Lead={id:string;name:string;phone:string;deal:string;propertyType:string;neighborhood:string;consultant:string;status:"new"|"contacted"|"follow_up";followUpAt:string|null;visitPreferredAt:string|null};
const T=[
 {id:"hello",label:"پیگیری اولیه",text:"سلام {{name}}، وقت بخیر. از طرف گروه مشاورین املاک هیرمند برای پیگیری درخواست {{deal}} در {{neighborhood}} خدمتتان پیام می‌دهم. اگر زمان مناسبی دارید، برای هماهنگی راهنمایی‌تان می‌کنم."},
 {id:"visit",label:"هماهنگی بازدید",text:"سلام {{name}} عزیز، برای هماهنگی بازدید {{propertyType}} در {{neighborhood}} از طرف هیرمند پیام می‌دهم. زمان پیشنهادی شما: {{visit}}. لطفاً زمان مناسب را اعلام بفرمایید."},
 {id:"follow",label:"یادآوری پیگیری",text:"سلام {{name}}، وقت بخیر. پیگیری درخواست {{deal}} شما در هیرمند را انجام می‌دهم. هر زمان آماده بودید، شرایط جدید و فایل‌های مناسب را برایتان ارسال می‌کنم."},
 {id:"custom",label:"متن سفارشی",text:"سلام {{name}} عزیز، وقت بخیر. "},
];
const dealLabel=(v:string)=>v==="sell"||v.includes("فروش")?"فروش":v==="buy"||v.includes("خرید")?"خرید":v==="rent"||v.includes("اجاره")?"اجاره":v==="mortgage"||v.includes("رهن")?"رهن":v||"درخواست";
const phone98=(v:string)=>{const d=v.replace(/[^\d+]/g,"");if(d.startsWith("+98"))return "98"+d.slice(3);if(d.startsWith("0098"))return "98"+d.slice(4);if(d.startsWith("98"))return d;if(d.startsWith("0"))return "98"+d.slice(1);return d;};
const dateFa=(v:string|null)=>v?new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date(v)):"زمانی ثبت نشده";

export function AdminWhatsappCenter(){
 const[leads,setLeads]=useState<Lead[]>([]),[selectedId,setSelectedId]=useState(""),[template,setTemplate]=useState("hello"),[custom,setCustom]=useState(""),[loading,setLoading]=useState(true);
 const selected=leads.find(x=>x.id===selectedId)??leads[0]??null;
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/leads-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",limit:100,offset:0,sort:"follow_up"})});const d=await r.json().catch(()=>({})) as {leads?:Lead[];statusMessage?:string};if(!r.ok)throw new Error(d.statusMessage||"مخاطبان بارگذاری نشد.");const items=Array.isArray(d.leads)?d.leads.filter(x=>(x.status==="new"||x.status==="contacted"||x.status==="follow_up")&&x.phone):[];setLeads(items);setSelectedId(cur=>items.some(x=>x.id===cur)?cur:(items[0]?.id??""));}catch(e){toast.error(adminErrorMessage(e,"مخاطبان بارگذاری نشد."));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const message=useMemo(()=>{if(!selected)return"";const source=template==="custom"?custom:(T.find(x=>x.id===template)?.text??"");return source.replaceAll("{{name}}",selected.name||"مشتری").replaceAll("{{deal}}",dealLabel(selected.deal)).replaceAll("{{propertyType}}",selected.propertyType||"ملک").replaceAll("{{neighborhood}}",selected.neighborhood||"محله موردنظر").replaceAll("{{visit}}",dateFa(selected.visitPreferredAt));},[selected,template,custom]);
 async function log(type:"whatsapp"|"call"){if(!selected)return;try{await fetch("/api/leads-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"activity",id:selected.id,activityType:type,activityTitle:type==="whatsapp"?"پیام واتساپ":"تماس تلفنی",activityNote:type==="whatsapp"?message:"تماس از مرکز ارتباط مشتری",activityMetadata:{template}})});}catch{}}
 function openWa(){if(!selected||!message.trim())return;const p=phone98(selected.phone);if(p.length<10){toast.error("شماره تلفن معتبر نیست.");return;}void log("whatsapp");window.open("https://wa.me/"+p+"?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");}
 async function copy(){try{await navigator.clipboard.writeText(message);toast.success("متن پیام کپی شد.");}catch{toast.error("کپی پیام انجام نشد.");}}
 return <section className="admin-panel" aria-label="مرکز پیام‌رسانی واتساپ">
  <div className="admin-panel-head"><div><span className="kicker">ارتباط مشتری</span><h2>مرکز پیام‌رسانی سریع واتساپ</h2><p>پیام را شخصی‌سازی کن، واتساپ را باز کن و همان لحظه فعالیت را در CRM ثبت کن.</p></div><button className="btn-ghost" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> بروزرسانی</button></div>
  <div style={{display:"grid",gridTemplateColumns:"300px minmax(0,1fr)",gap:10}}>
   <div style={{display:"grid",gap:6,maxHeight:620,overflow:"auto"}}>
    {loading?<div className="admin-empty"><RefreshCw size={22} className="admin-spin"/>در حال دریافت…</div>:!leads.length?<div className="admin-empty"><Check size={22}/>لید فعالی با شماره پیدا نشد.</div>:leads.map(l=><button key={l.id} type="button" onClick={()=>setSelectedId(l.id)} style={{textAlign:"right",padding:10,border:"1px solid "+(selected?.id===l.id?"var(--brass-500)":"var(--line)"),borderRadius:11,background:"var(--card,#fff)",cursor:"pointer"}}><strong style={{display:"block",color:"var(--navy-900)"}}>{l.name||"بدون نام"}</strong><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{l.phone} · {dealLabel(l.deal)}{l.neighborhood?" · "+l.neighborhood:""}</small></button>)}
   </div>
   <div style={{display:"grid",gap:10,padding:13,border:"1px solid var(--line)",borderRadius:14,background:"var(--card,#fff)"}}>
    {!selected?<div className="admin-empty">یک مشتری را انتخاب کنید.</div>:<><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",padding:10,borderRadius:11,background:"var(--surface-2,#f7f5f0)"}}><div><strong>{selected.name||"مشتری بدون نام"}</strong><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{selected.phone} · {selected.consultant||"بدون مشاور"}{selected.followUpAt?" · پیگیری: "+dateFa(selected.followUpAt):""}</small></div><a className="btn-ghost" href={"tel:"+selected.phone}><Phone size={14}/> تماس</a></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{T.map(x=><button key={x.id} type="button" className="btn-ghost" onClick={()=>setTemplate(x.id)} aria-pressed={template===x.id} style={template===x.id?{borderColor:"var(--brass-500)",background:"var(--brass-50,#fbf7ef)"}:undefined}>{x.label}</button>)}</div>
    <textarea value={message} onChange={e=>{setTemplate("custom");setCustom(e.target.value);}} aria-label="متن پیام واتساپ" style={{minHeight:230,lineHeight:2}} />
    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button type="button" className="btn-gold" onClick={openWa}><Send size={15}/> باز کردن واتساپ و ثبت فعالیت</button><button type="button" className="btn-ghost" onClick={()=>void copy()}><Copy size={14}/> کپی متن</button><button type="button" className="btn-ghost" onClick={()=>void log("call")}><Phone size={14}/> ثبت تماس</button></div>
    <p style={{margin:0,color:"var(--subtle)",fontSize:".62rem"}}><Sparkles size={12} style={{verticalAlign:"middle"}}/> ارسال پیام توسط خود واتساپ انجام می‌شود؛ پنل فقط متن آماده می‌کند و فعالیت CRM را ثبت می‌کند.</p></>}
   </div>
  </div>
 </section>;
}