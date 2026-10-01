import { MessageCircle, PhoneCall, RefreshCw, Send, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TEAM } from "@/lib/site";
import "@/customer-engagement.css";

type Conversation={id:string;propertyTitle:string;consultantName:string;status:string;unreadCount:number;lastMessage:string;updatedAt:string};
type ChatMessage={id:number;senderType:string;body:string;createdAt:string};
type Callback={id:string;name:string;phone:string;preferredAt:string|null;propertyTitle:string;note:string;status:string;createdAt:string};

export function AdminCustomerInbox(){
  const [tab,setTab]=useState<"chat"|"callback">("chat");
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [callbacks,setCallbacks]=useState<Callback[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

  async function post(path:string,body:Record<string,unknown>){
    const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>null) as {statusMessage?:string};
    if(!response.ok) throw new Error(data?.statusMessage||"عملیات انجام نشد.");
    return data as any;
  }
  async function load(){
    setLoading(true);
    try{
      const [chat,cb]=await Promise.all([post("/api/admin-customer-chat",{action:"list"}),post("/api/admin-callback-requests",{action:"list"})]);
      const next=Array.isArray(chat.conversations)?chat.conversations:[]; setConversations(next);
      setCallbacks(Array.isArray(cb.callbacks)?cb.callbacks:[]);
      setSelected((current)=>current??next[0]?.id??null);
    }catch(e){toast.error(e instanceof Error?e.message:"صندوق مشتریان بارگذاری نشد.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(t);},[]);
  useEffect(()=>{
    if(!selected||tab!=="chat") return;
    const read=()=>void post("/api/admin-customer-chat",{action:"messages",conversationId:selected}).then((data)=>setMessages(Array.isArray(data.messages)?data.messages:[])).catch(()=>{});
    read(); const t=window.setInterval(read,10000); return()=>window.clearInterval(t);
  },[selected,tab]);

  const selectedConversation=useMemo(()=>conversations.find((item)=>item.id===selected)??null,[conversations,selected]);

  async function send(){
    if(!selected||!draft.trim()||busy)return;
    setBusy(true);
    try{await post("/api/admin-customer-chat",{action:"send",conversationId:selected,message:draft.trim()});setDraft("");const data=await post("/api/admin-customer-chat",{action:"messages",conversationId:selected});setMessages(data.messages??[]);await load();}
    catch(e){toast.error(e instanceof Error?e.message:"پاسخ ارسال نشد.");}
    finally{setBusy(false);}
  }
  async function updateConversation(body:Record<string,unknown>){
    if(!selected)return;setBusy(true);
    try{await post("/api/admin-customer-chat",{conversationId:selected,...body});await load();toast.success("گفت‌وگو به‌روزرسانی شد.");}
    catch(e){toast.error(e instanceof Error?e.message:"به‌روزرسانی انجام نشد.");}
    finally{setBusy(false);}
  }
  async function updateCallback(id:string,status:string){
    try{await post("/api/admin-callback-requests",{action:"status",id,status});setCallbacks((items)=>items.map((item)=>item.id===id?{...item,status}:item));toast.success("وضعیت درخواست تماس به‌روزرسانی شد.");}
    catch(e){toast.error(e instanceof Error?e.message:"وضعیت تماس تغییر نکرد.");}
  }

  return (
    <section className="admin-panel customer-inbox-panel">
      <div className="admin-panel-head">
        <div><span className="kicker">ارتباط با مشتری</span><h2>صندوق گفتگو و تماس</h2></div>
        <button type="button" className="btn-ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?"در حال دریافت…":"تازه‌سازی"}</button>
      </div>
      <div className="customer-inbox-tabs">
        <button type="button" className={tab==="chat"?"is-active":""} onClick={()=>setTab("chat")}><MessageCircle size={15}/>گفت‌وگوها {conversations.filter((x)=>x.unreadCount>0).length>0?"("+conversations.filter((x)=>x.unreadCount>0).length+")":""}</button>
        <button type="button" className={tab==="callback"?"is-active":""} onClick={()=>setTab("callback")}><PhoneCall size={15}/>درخواست تماس {callbacks.filter((x)=>x.status==="new").length>0?"("+callbacks.filter((x)=>x.status==="new").length+")":""}</button>
      </div>
      {tab==="chat"?(
        <div className="customer-inbox-grid">
          <div className="customer-inbox-list">
            {!conversations.length?<div className="customer-chat-empty"><MessageCircle size={24}/><strong>هنوز گفت‌وگویی نیست</strong></div>:conversations.map((item)=>(
              <button key={item.id} type="button" className={item.id===selected?"is-active":""} onClick={()=>setSelected(item.id)}>
                <span><strong>{item.propertyTitle||"گفت‌وگوی عمومی"}</strong><small>{item.lastMessage||"پیام جدید"}</small></span>
                {item.unreadCount?<em>{item.unreadCount.toLocaleString("fa-IR")}</em>:null}
              </button>
            ))}
          </div>
          <div className="customer-inbox-thread">
            {selectedConversation?(
              <>
                <header>
                  <div><UserRound size={17}/><strong>{selectedConversation.consultantName||"مشتری"}</strong><small>{selectedConversation.propertyTitle||"بدون فایل مشخص"}</small></div>
                  <div className="customer-inbox-controls">
                    <select value={selectedConversation.consultantName} onChange={(e)=>void updateConversation({action:"assign",consultantName:e.target.value})} aria-label="مشاور">
                      <option value="">بدون مشاور</option>{TEAM.map((person)=><option key={person.id} value={person.name}>{person.name}</option>)}
                    </select>
                    <select value={selectedConversation.status} onChange={(e)=>void updateConversation({action:"status",status:e.target.value})} aria-label="وضعیت">
                      <option value="open">باز</option><option value="waiting_consultant">در انتظار مشاور</option><option value="waiting_customer">در انتظار مشتری</option><option value="closed">بسته</option>
                    </select>
                  </div>
                </header>
                <div className="customer-inbox-messages">{messages.map((m)=><div key={m.id} className={"customer-chat-message "+(m.senderType==="customer"?"from-customer":"from-team")}><div>{m.body}</div><small>{new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date(m.createdAt))}</small></div>)}</div>
                <div className="customer-chat-compose"><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} rows={2} placeholder="پاسخ مشاور…"/><button type="button" className="btn-gold" onClick={()=>void send()} disabled={busy||!draft.trim()}><Send size={15}/>{busy?"در حال ارسال…":"ارسال پاسخ"}</button></div>
              </>
            ):<div className="customer-chat-empty"><MessageCircle size={26}/><strong>یک گفت‌وگو را انتخاب کنید.</strong></div>}
          </div>
        </div>
      ):(
        <div className="customer-callback-admin-list">
          {!callbacks.length?<div className="customer-chat-empty"><PhoneCall size={24}/><strong>درخواست تماس جدیدی نیست</strong></div>:callbacks.map((item)=>(
            <article key={item.id}>
              <div><strong>{item.name}</strong><a href={"tel:"+item.phone} dir="ltr">{item.phone}</a><small>{item.propertyTitle||"درخواست عمومی"} · {new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.preferredAt||item.createdAt))}</small>{item.note?<p>{item.note}</p>:null}</div>
              <select value={item.status} onChange={(e)=>void updateCallback(item.id,e.target.value)} aria-label={"وضعیت تماس "+item.name}>
                <option value="new">جدید</option><option value="contacted">تماس گرفته شد</option><option value="scheduled">زمان‌بندی شد</option><option value="completed">انجام شد</option><option value="cancelled">لغو شد</option>
              </select>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
