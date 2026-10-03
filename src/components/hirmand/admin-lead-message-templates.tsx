import { useMemo,useState } from "react";
import { Copy,MessageCircle,Phone } from "lucide-react";
import { toast } from "sonner";
type Lead={name:string;phone:string;deal:string;neighborhood:string;requestedBedrooms:number|null;consultant:string;followUpAt:string|null};
const normalizePhone=(value:string)=>{const p=value.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/D/g,"");return p.startsWith("0098")?p.slice(2):p.startsWith("98")?p:p.replace(/^0/,"98");};
const fill=(body:string,l:Lead)=>body.replaceAll("{{نام}}",l.name||"مشتری").replaceAll("{{محله}}",l.neighborhood||"درخواستی شما").replaceAll("{{معامله}}",l.deal||"ملک").replaceAll("{{خواب}}",l.requestedBedrooms==null?"":String(l.requestedBedrooms)).replaceAll("{{مشاور}}",l.consultant||"هیرمند");
const TEMPLATES=[
 {id:"first",title:"اولین پیگیری",body:"سلام {{نام}}، درباره درخواست {{معامله}} در {{محله}} با شما تماس گرفتم. برای هماهنگی و معرفی فایل‌های مناسب هیرمند در خدمتم."},
 {id:"visit",title:"هماهنگی بازدید",body:"سلام {{نام}}، برای هماهنگی بازدید فایل‌های مناسب {{محله}} پیام دادم. زمان مناسب شما را اعلام می‌کنید؟"},
 {id:"match",title:"ارسال فایل مناسب",body:"سلام {{نام}}، چند فایل مناسب درخواست شما پیدا کردم. در صورت تمایل مشخصات و زمان بازدید را برایتان ارسال می‌کنم."},
 {id:"reminder",title:"یادآوری پیگیری",body:"سلام {{نام}}، طبق پیگیری قبلی در خدمتتان هستم. هنوز درخواست {{معامله}} شما فعال است؟"},
 {id:"follow",title:"پیگیری پس از بازدید",body:"سلام {{نام}}، ممنون بابت بازدید امروز. نظر شما درباره فایل چیست تا گزینه‌های بعدی را بر اساس نظرتان آماده کنم؟"}
];
type Props={leads:Lead[]};
export function AdminLeadMessageTemplates({leads}:Props){
 const [leadId,setLeadId]=useState(""),[templateId,setTemplateId]=useState("first");
 const lead=useMemo(()=>leads.find((x:any)=>x.id===leadId) as (Lead&{id:string})|undefined,[leads,leadId]); const template=TEMPLATES.find(x=>x.id===templateId)||TEMPLATES[0];
 const message=lead?fill(template.body,lead):template.body;
 const copy=async()=>{try{await navigator.clipboard.writeText(message);toast.success("متن پیام کپی شد.");}catch{toast.error("کپی مستقیم در این مرورگر در دسترس نیست.");}};
 const whatsapp=lead?"https://wa.me/"+normalizePhone(lead.phone)+"?text="+encodeURIComponent(message):"";
 return <section className="admin-panel admin-message-templates" dir="rtl"><div className="admin-panel-head"><div><span className="kicker">ابزار CRM</span><h2><MessageCircle size={18}/> پیام‌های آماده پیگیری</h2><p>پیام با اطلاعات مشتری پر می‌شود و بدون ارسال خودکار، اختیار ارسال در دست شماست.</p></div></div><div className="admin-message-grid"><label className="field"><span>مشتری</span><select value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">انتخاب مشتری</option>{(leads as any[]).map(l=><option key={l.id} value={l.id}>{l.name+" · "+l.phone}</option>)}</select></label><label className="field"><span>نوع پیام</span><select value={templateId} onChange={e=>setTemplateId(e.target.value)}>{TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div><textarea className="admin-message-preview" value={message} onChange={()=>{}} aria-label="پیش‌نمایش پیام" /><div className="admin-message-actions"><button className="btn-gold" type="button" onClick={()=>void copy()}><Copy size={15}/>کپی متن</button>{whatsapp?<a className="btn-ghost" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={15}/>باز کردن واتساپ</a>:null}{lead?<a className="btn-ghost" href={"tel:"+lead.phone}><Phone size={15}/>تماس</a>:null}</div></section>;
}
