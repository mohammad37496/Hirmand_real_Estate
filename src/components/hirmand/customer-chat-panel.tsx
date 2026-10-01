import { MessageCircle, Send, X, RefreshCw, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { customerFetch } from "@/lib/customer-fetch";
import "@/customer-engagement.css";

type Conversation={id:string;propertyId:string|null;propertyTitle:string;consultantName:string;status:string;unreadCount:number;lastMessage:string;createdAt:string;updatedAt:string;lastMessageAt:string|null};
type ChatMessage={id:number;senderType:string;senderId:string;body:string;readAt:string|null;createdAt:string};

export function CustomerChatPanel({propertyId,propertyTitle}:{propertyId?:string;propertyTitle?:string}) {
  const [open,setOpen]=useState(false);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(false);
  const [sending,setSending]=useState(false);

  const call=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
    const response=await customerFetch("/api/customer-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...extra})});
    const data=await response.json().catch(()=>null) as {statusMessage?:string};
    if(!response.ok) throw new Error(data?.statusMessage||"گفت‌وگو در دسترس نیست.");
    return data as any;
  },[]);

  const loadConversations=useCallback(async()=>{
    const data=await call("list");
    const next=Array.isArray(data.conversations)?data.conversations:[];
    setConversations(next);
    setConversationId((current)=>current??next[0]?.id??null);
  },[call]);

  const loadMessages=useCallback(async(id:string)=>{
    const data=await call("messages",{conversationId:id});
    setMessages(Array.isArray(data.messages)?data.messages:[]);
    await call("seen",{conversationId:id}).catch(()=>{});
  },[call]);

  useEffect(()=>{
    if(!open) return;
    setLoading(true);
    void loadConversations().catch((e)=>toast.error(e instanceof Error?e.message:"گفت‌وگو بارگذاری نشد.")).finally(()=>setLoading(false));
  },[open,loadConversations]);

  useEffect(()=>{
    if(!open||!conversationId) return;
    void loadMessages(conversationId);
    const timer=window.setInterval(()=>void loadMessages(conversationId),10000);
    return()=>window.clearInterval(timer);
  },[open,conversationId,loadMessages]);

  async function send(){
    const message=draft.trim();
    if(!message||sending) return;
    setSending(true);
    try{
      const data=await call("send",{conversationId:conversationId??undefined,message,propertyId,propertyTitle});
      setConversationId(data.conversationId);
      setDraft("");
      await loadMessages(String(data.conversationId));
      await loadConversations();
    }catch(e){
      toast.error(e instanceof Error?e.message:"ارسال پیام انجام نشد.");
    }finally{setSending(false);}
  }

  const selected=conversations.find((item)=>item.id===conversationId)??null;
  const hasUnread=conversations.reduce((sum,item)=>sum+item.unreadCount,0);

  return (
    <>
      <button type="button" className="customer-engage-fab customer-chat-fab" onClick={()=>setOpen((v)=>!v)} aria-expanded={open} aria-label="گفت‌وگو با مشاور">
        {open?<X size={19}/>:<MessageCircle size={19}/>}
        {!open&&hasUnread?<span className="customer-engage-badge">{hasUnread.toLocaleString("fa-IR")}</span>:null}
      </button>
      {open?(
        <section className="customer-chat-panel" aria-label="گفت‌وگوی هیرمند">
          <header className="customer-chat-head">
            <div><span className="kicker">پاسخ‌گویی هیرمند</span><strong>{selected?.consultantName||"گفت‌وگو با مشاور"}</strong></div>
            <button type="button" className="customer-mini-button" onClick={()=>void loadConversations()} aria-label="تازه‌سازی"><RefreshCw size={15}/></button>
          </header>
          {loading?(
            <div className="customer-chat-empty"><RefreshCw size={22} className="admin-spin"/><span>در حال بارگذاری…</span></div>
          ):(
            <>
              {conversations.length>1?(
                <div className="customer-chat-conversations">
                  {conversations.map((item)=>(
                    <button key={item.id} type="button" className={item.id===conversationId?"is-active":""} onClick={()=>setConversationId(item.id)}>
                      <span>{item.propertyTitle||"گفت‌وگوی عمومی"}</span>
                      {item.unreadCount?<em>{item.unreadCount.toLocaleString("fa-IR")}</em>:null}
                    </button>
                  ))}
                </div>
              ):null}
              <div className="customer-chat-messages">
                {!messages.length?<div className="customer-chat-empty"><MessageCircle size={28}/><strong>پیام جدیدی نیست</strong><span>سؤال خود را بپرسید؛ پیام شما برای تیم هیرمند ثبت می‌شود.</span></div>:
                  messages.map((message)=>(
                    <div key={message.id} className={"customer-chat-message "+(message.senderType==="customer"?"from-customer":"from-team")}>
                      <div>{message.body}</div><small>{new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date(message.createdAt))}</small>
                    </div>
                  ))
                }
              </div>
              <div className="customer-chat-compose">
                <textarea value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="پیام خود را بنویسید…" rows={2} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}/>
                <button type="button" className="btn-gold" onClick={()=>void send()} disabled={sending||!draft.trim()}><Send size={15}/>{sending?"در حال ارسال…":"ارسال"}</button>
              </div>
              {selected?.status==="closed"?<div className="customer-chat-closed"><ChevronDown size={14}/> این گفت‌وگو بسته شده است؛ با ارسال پیام دوباره فعال می‌شود.</div>:null}
            </>
          )}
        </section>
      ):null}
    </>
  );
}
