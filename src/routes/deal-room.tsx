import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, FilePlus2, Link2, LoaderCircle, Plus, Share2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { customerFetch } from "@/lib/customer-fetch";
import { formatToman } from "@/lib/money";
import { SITE } from "@/lib/site";
import "../deal-room.css";

type RoomItem = { slug:string; title:string; neighborhood:string; areaM2:number|null; bedrooms:number|null; price:string|null; deposit:string|null; rent:string|null; availabilityStatus:string; image:string|null; privateNote:string };
type RoomDoc = { id:string; title:string; url:string; kind:string; note:string; createdAt:string };
type Room = { id:string; name:string; status:string; shareToken:string|null; notes:string; updatedAt:string; items:RoomItem[]; documents:RoomDoc[] };

export const Route=createFileRoute("/deal-room")({
  head:()=>({meta:[
    {title:"اتاق معامله | "+SITE.nameFa},
    {name:"description",content:"فضای اختصاصی مشتری برای فایل‌های منتخب، یادداشت‌ها، مدارک و اشتراک‌گذاری."},
    {name:"robots",content:"noindex,nofollow"},
  ]}),
  component:DealRoomPage,
});

function amount(value:string|null){ const n=value?Number(value):NaN; return Number.isFinite(n)?formatToman(n)+" تومان":"—"; }

function DealRoomPage(){
  const [room,setRoom]=useState<Room|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [name,setName]=useState("");
  const [notes,setNotes]=useState("");
  const [docTitle,setDocTitle]=useState("");
  const [docUrl,setDocUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [shareUrl,setShareUrl]=useState("");

  async function call(action:string,extra:Record<string,unknown>={}){
    const response=await customerFetch("/api/customer-deal-room",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action,roomId:room?.id,...extra})});
    const data=await response.json().catch(()=>null) as {statusMessage?:string;room?:Room};
    if(!response.ok) throw new Error(data?.statusMessage||"عملیات اتاق معامله انجام نشد.");
    if(data.room) setRoom(data.room);
    return data;
  }

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const id=params.get("id"), token=params.get("token");
    void (async()=>{
      try{
        const response=token
          ? await fetch("/api/customer-deal-room?token="+encodeURIComponent(token),{credentials:"same-origin"})
          : id
            ? await customerFetch("/api/customer-deal-room",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"get",roomId:id})})
            : null;
        if(!response) throw new Error("اتاق معامله‌ای انتخاب نشده است.");
        const data=await response.json().catch(()=>null) as {room?:Room;statusMessage?:string};
        if(!response.ok||!data?.room) throw new Error(data?.statusMessage||"اتاق معامله پیدا نشد.");
        setRoom(data.room); setName(data.room.name); setNotes(data.room.notes);
        if(data.room.shareToken) setShareUrl(window.location.origin+"/deal-room?token="+data.room.shareToken);
      }catch(e){setError(e instanceof Error?e.message:"اتاق معامله بارگذاری نشد.");}
      finally{setLoading(false);}
    })();
  },[]);

  async function saveRoom(){
    if(!room)return; setBusy(true);
    try{await call("update",{name:name.trim()||"اتاق معامله من",notes});}
    catch(e){setError(e instanceof Error?e.message:"ذخیره انجام نشد.");}
    finally{setBusy(false);}
  }
  async function removeItem(slug:string){
    if(!room)return; setBusy(true);
    try{await call("remove",{slug});}
    catch(e){setError(e instanceof Error?e.message:"حذف فایل انجام نشد.");}
    finally{setBusy(false);}
  }
  async function createShare(){
    if(!room)return; setBusy(true);
    try{
      const data=await call("share");
      const token=(data.room as Room|undefined)?.shareToken;
      if(!token) throw new Error("لینک اشتراک ساخته نشد.");
      const url=window.location.origin+"/deal-room?token="+token; setShareUrl(url);
      if(navigator.share) await navigator.share({title:name||"اتاق معامله هیرمند",text:"لیست فایل‌های منتخب من در هیرمند",url});
      else if(navigator.clipboard) { await navigator.clipboard.writeText(url); setError(""); }
    }catch(e){ if(!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"اشتراک‌گذاری انجام نشد."); }
    finally{setBusy(false);}
  }
  async function addDoc(){
    if(!room||!docTitle.trim()||!docUrl.trim())return; setBusy(true);
    try{await call("add_document",{title:docTitle.trim(),url:docUrl.trim(),kind:"link"});setDocTitle("");setDocUrl("");}
    catch(e){setError(e instanceof Error?e.message:"افزودن لینک انجام نشد.");}
    finally{setBusy(false);}
  }
  async function removeDoc(id:string){
    if(!room)return; setBusy(true);
    try{await call("remove_document",{slug:id});}
    catch(e){setError(e instanceof Error?e.message:"حذف لینک انجام نشد.");}
    finally{setBusy(false);}
  }

  if(loading)return <main className="deal-room-page"><section className="deal-room-empty"><LoaderCircle size={26} className="admin-spin"/>در حال آماده‌سازی اتاق معامله…</section></main>;
  if(error&&!room)return <main className="deal-room-page"><section className="deal-room-empty"><strong>{error}</strong><a className="btn-gold" href="/customer-dashboard">بازگشت به داشبورد</a></section></main>;
  if(!room)return null;

  return <main className="deal-room-page">
    <header className="deal-room-hero">
      <div><span className="kicker"><Link2 size={13}/> اتاق معامله مشتری</span><h1>{name||"اتاق معامله من"}</h1><p>فایل‌های منتخب، یادداشت‌ها و لینک‌های معامله در یک فضای اختصاصی.</p></div>
      <div className="deal-room-hero-actions"><button type="button" className="btn-gold" onClick={()=>void createShare()} disabled={busy}><Share2 size={15}/>اشتراک‌گذاری</button><a className="btn-ghost" href="/favorites">بازگشت به ذخیره‌ها</a></div>
    </header>
    {error?<div className="deal-room-error" role="alert">{error}</div>:null}

    <section className="deal-room-card deal-room-settings">
      <div><span className="kicker">تنظیمات</span><h2>نام و یادداشت اتاق</h2></div>
      <div className="deal-room-settings-grid">
        <label className="field"><span>نام اتاق</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label>
        <label className="field"><span>یادداشت کلی</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={3000}/></label>
      </div>
      <div className="deal-room-actions"><button type="button" className="btn-gold" onClick={()=>void saveRoom()} disabled={busy}>ذخیره تغییرات</button>{shareUrl?<button type="button" className="btn-ghost" onClick={()=>navigator.clipboard&&void navigator.clipboard.writeText(shareUrl)}>کپی لینک اشتراک</button>:null}</div>
    </section>

    <section className="deal-room-card">
      <div className="deal-room-section-head"><div><span className="kicker">منتخب‌ها</span><h2>{room.items.length.toLocaleString("fa-IR")} فایل در اتاق معامله</h2></div><a className="btn-ghost" href="/compare">مقایسه فایل‌ها</a></div>
      {room.items.length?<div className="deal-room-items">{room.items.map(item=><article className="deal-room-property" key={item.slug}>
        {item.image?<img src={item.image} alt="" loading="lazy"/>:<div className="deal-room-property-placeholder"></div>}
        <div className="deal-room-property-main"><strong>{item.title}</strong><span>{item.neighborhood}{item.areaM2?" · "+item.areaM2.toLocaleString("fa-IR")+" متر":""}{item.bedrooms!=null?" · "+item.bedrooms.toLocaleString("fa-IR")+" خواب":""}</span><small>{item.price?amount(item.price):item.rent?amount(item.rent):item.deposit?amount(item.deposit):"قیمت تماس"}</small>{item.privateNote?<p>{item.privateNote}</p>:null}</div>
        <div className="deal-room-property-actions"><a href={"/properties/"+encodeURIComponent(item.slug)} className="btn-ghost"><ExternalLink size={14}/>مشاهده</a><button type="button" className="deal-room-icon-danger" onClick={()=>void removeItem(item.slug)} disabled={busy}><Trash2 size={15}/></button></div>
      </article>)}</div>:<div className="deal-room-empty compact">هنوز فایلی در این اتاق نیست.</div>}
    </section>

    <section className="deal-room-card">
      <div className="deal-room-section-head"><div><span className="kicker">مدارک و لینک‌ها</span><h2>اسناد معامله</h2></div></div>
      <p className="deal-room-note">برای حفظ امنیت، اینجا لینک اسناد امن یا فایل‌های ابری شما نگه‌داری می‌شود.</p>
      <div className="deal-room-document-form">
        <label className="field"><span>عنوان</span><input value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="مثلاً پیش‌نویس قرارداد"/></label>
        <label className="field"><span>لینک امن</span><input dir="ltr" value={docUrl} onChange={e=>setDocUrl(e.target.value)} placeholder="https://..."/></label>
        <button type="button" className="btn-gold" onClick={()=>void addDoc()} disabled={busy||!docTitle.trim()||!docUrl.trim()}><Plus size={15}/>افزودن</button>
      </div>
      <div className="deal-room-documents">{room.documents.length?room.documents.map(doc=><article key={doc.id}><FilePlus2 size={17}/><div><strong>{doc.title}</strong><small>{doc.kind}</small></div><a href={doc.url} target="_blank" rel="noopener noreferrer">باز کردن</a><button type="button" onClick={()=>void removeDoc(doc.id)} disabled={busy} aria-label="حذف مدرک"><Trash2 size={14}/></button></article>):<div className="deal-room-empty compact">هنوز سندی اضافه نشده است.</div>}</div>
    </section>
  </main>;
}
