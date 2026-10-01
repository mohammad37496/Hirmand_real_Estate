import { ArrowLeft, Mic2, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NEIGHBORHOOD_NAMES } from "@/lib/site";
import "@/smart-property-assistant.css";

const DIGITS="۰۱۲۳۴۵۶۷۸۹";
const WORDS:Record<string,number>={یک:1,دو:2,سه:3,چهار:4,پنج:5,شش:6,هفت:7,هشت:8,نه:9,ده:10};
const DEALS:[string,string][]=[["خرید","buy"],["فروش","sell"],["اجاره","rent"],["رهن","mortgage"]];
const TYPES:[string,string][]=[["آپارتمان","apartment"],["ویلا","villa"],["باغ","villa"],["اداری","office"],["تجاری","commercial"],["زمین","land"],["خانه اصیل","heritage"]];

function digits(value:string){return value.replace(/[۰-۹]/g,d=>String(DIGITS.indexOf(d))).replace(/[,،]/g,"");}
function amount(raw:string){const n=Number(digits(raw).replace(/[^d.]/g,""));return Number.isFinite(n)?n:undefined;}
function parsePrice(text:string){
  const m=text.match(/(?:تا|حدود|زیر|کمتر از|حداکثر|حداکثر تا|بودجه.{0,8})(?:s*)([۰-۹\d.,]+)\s*(میلیارد|میلیون)?/);
  if(!m)return undefined;
  const n=amount(m[1]??""); if(n==null)return undefined;
  return Math.round(n*((m[2]==="میلیارد")?1_000_000_000:(m[2]==="میلیون"?1_000_000:1)));
}
function parseMinPrice(text:string){
  const m=text.match(/(?:از|حداقل|شروع از)\s*([۰-۹\d.,]+)\s*(میلیارد|میلیون)?/);
  if(!m)return undefined;
  const n=amount(m[1]??"");return n==null?undefined:Math.round(n*((m[2]==="میلیارد")?1_000_000_000:(m[2]==="میلیون"?1_000_000:1)));
}
function parseArea(text:string){
  const matches=[...text.matchAll(/([۰-۹\d]+)\s*(?:تا|-)\s*([۰-۹\d]+)\s*متر/g)];
  const first=matches[0]; if(first){return [amount(first[1]??""),amount(first[2]??"")] as const;}
  const single=text.match(/(?:حداقل|بیش از|از)\s*([۰-۹\d]+)\s*متر/);
  return single?[amount(single[1]??"")]:undefined;
}
function parseBedrooms(text:string){
  const match=text.match(/([۰-۹\d]+|یک|دو|سه|چهار|پنج)\s*خو(?:ابه|اب)/);
  if(!match)return undefined;
  return WORDS[match[1]??""]??amount(match[1]??"");
}

export function SmartPropertyAssistant(){
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [chips,setChips]=useState<string[]>([]);
  const [hint,setHint]=useState("");
  const parsed=useMemo(()=>{
    const lower=text.trim().toLocaleLowerCase();
    const params=new URLSearchParams();
    const found:string[]=[];
    const deal=DEALS.find(([label])=>lower.includes(label));
    if(deal){params.set("transaction",deal[1]);found.push("معامله: "+deal[0]);}
    const type=TYPES.find(([label])=>lower.includes(label));
    if(type){params.set("type",type[1]);found.push("ملک: "+type[0]);}
    const area=NEIGHBORHOOD_NAMES.find(name=>lower.includes(name.toLocaleLowerCase()));
    if(area){params.set("neighborhood",area);found.push("محله: "+area);}
    const maxPrice=parsePrice(lower),minPrice=parseMinPrice(lower);
    if(maxPrice){params.set("maxPrice",String(maxPrice));found.push("سقف بودجه: "+Math.round(maxPrice/1_000_000)+" میلیون");}
    if(minPrice){params.set("minPrice",String(minPrice));found.push("کف بودجه: "+Math.round(minPrice/1_000_000)+" میلیون");}
    const ar=parseArea(lower);
    if(ar?.[0]!=null)params.set("minArea",String(ar[0]));
    if(ar?.[1]!=null){params.set("maxArea",String(ar[1]));found.push("متراژ: "+ar[0]+" تا "+ar[1]+" متر");}
    else if(ar?.[0]!=null)found.push("حداقل متراژ: "+ar[0]+" متر");
    const beds=parseBedrooms(lower); if(beds!=null){params.set("minBedrooms",String(beds));found.push("خواب: "+beds+" به بالا");}
    if(lower.includes("پارکینگ")){params.set("parkingOnly","true");found.push("پارکینگ");}
    if(lower.includes("آسانسور")){params.set("elevatorOnly","true");found.push("آسانسور");}
    if(lower.includes("انباری")){params.set("storageOnly","true");found.push("انباری");}
    return {params,found};
  },[text]);

  function search(){
    if(!text.trim())return;
    setBusy(true); setChips(parsed.found); setHint(parsed.found.length?"فیلترها استخراج شدند؛ نتایج را ببینید.":"جزئیات قابل تشخیص پیدا نشد؛ جست‌وجوی عمومی باز می‌شود.");
    window.setTimeout(()=>window.location.assign("/properties?"+parsed.params.toString()),180);
  }
  function voice(){
    const Recognition=(window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if(!Recognition){setHint("تشخیص صدا در این مرورگر در دسترس نیست.");return;}
    const recognition=new Recognition(); recognition.lang="fa-IR"; recognition.interimResults=false; recognition.maxAlternatives=1;
    recognition.onresult=(event:any)=>{setText(event.results?.[0]?.[0]?.transcript??"");};
    recognition.onerror=()=>setHint("تشخیص صدا انجام نشد؛ متن را وارد کنید.");
    recognition.start();
  }

  return <section className="smart-property-assistant" aria-labelledby="smart-property-assistant-title">
    <div className="smart-property-assistant-head"><div><span className="kicker"><Sparkles size={13}/> دستیار جست‌وجوی هوشمند</span><h2 id="smart-property-assistant-title">نیازتان را یک‌جا بنویسید</h2><p>مثلاً: «آپارتمان دوخوابه در سپاهان‌شهر تا ۵ میلیارد با پارکینگ و آسانسور».</p></div><Mic2 size={24}/></div>
    <div className="smart-property-assistant-compose">
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="شرایط ملک دلخواهتان را طبیعی بنویسید…" />
      <div className="smart-property-assistant-actions">
        <button type="button" className="btn-ghost" onClick={voice} disabled={busy}><Mic2 size={15}/> گفتار</button>
        <button type="button" className="btn-gold" onClick={search} disabled={busy || !text.trim()}><Search size={15}/> پیدا کردن فایل</button>
      </div>
    </div>
    {chips.length?<div className="smart-property-assistant-chips">{chips.map(c=><span key={c}>{c}<X size={11}/></span>)}</div>:null}
    {hint?<div className="smart-property-assistant-hint"><ArrowLeft size={13}/> {hint}</div>:null}
  </section>;
}