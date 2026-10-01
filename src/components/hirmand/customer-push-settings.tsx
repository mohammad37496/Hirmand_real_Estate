import { BellRing, BellOff, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { customerFetch } from "@/lib/customer-fetch";
import "@/customer-engagement.css";

function base64ToBytes(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/")+padding;
  const raw=atob(normalized);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function supported(){
  return typeof window!=="undefined"&&"Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window&&window.isSecureContext;
}

export function CustomerPushSettings({compact=false}:{compact?:boolean}) {
  const [configured,setConfigured]=useState(false);
  const [status,setStatus]=useState<"unknown"|"off"|"on"|"unsupported">("unknown");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    void fetch("/api/push-config",{cache:"no-store"}).then((r)=>r.json()).then((data:{configured?:boolean})=>{if(active)setConfigured(Boolean(data.configured));}).catch(()=>{});
    if(!supported()) setStatus("unsupported");
    else if(Notification.permission==="granted") setStatus("on");
    else setStatus("off");
    return()=>{active=false;};
  },[]);

  async function enable(){
    if(!supported()){setStatus("unsupported");toast.info("این مرورگر Push وب را در این حالت پشتیبانی نمی‌کند.");return;}
    if(!configured){toast.info("زیرساخت اعلان آماده است؛ کلید VAPID سرور هنوز تنظیم نشده است.");return;}
    setBusy(true);
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){setStatus("off");toast.info("مجوز اعلان داده نشد.");return;}
      const registration=await navigator.serviceWorker.register("/sw.js");
      const data=await fetch("/api/push-config",{cache:"no-store"}).then((r)=>r.json()) as {publicKey?:string};
      if(!data.publicKey) throw new Error("کلید عمومی اعلان تنظیم نشده است.");
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToBytes(data.publicKey)});
      const serialized=subscription.toJSON();
      await customerFetch("/api/push-subscription",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"subscribe",endpoint:serialized.endpoint,keys:serialized.keys})});
      setStatus("on");toast.success("اعلان‌های هیرمند فعال شد.");
    }catch(e){toast.error(e instanceof Error?e.message:"فعال‌سازی اعلان انجام نشد.");}
    finally{setBusy(false);}
  }

  async function disable(){
    setBusy(true);
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){
        await customerFetch("/api/push-subscription",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"unsubscribe",endpoint:subscription.endpoint})}).catch(()=>{});
        await subscription.unsubscribe().catch(()=>{});
      }
      setStatus("off");toast.success("اعلان‌های هیرمند غیرفعال شد.");
    }finally{setBusy(false);}
  }

  if(status==="unsupported") return compact ? <div className="customer-push-note"><ShieldCheck size={15}/><span>اعلان داخل سایت فعال است؛ Push این مرورگر/حالت را پشتیبانی نمی‌کند.</span></div> : null;
  if(!compact && status==="unknown") return null;
  if(!compact && status!=="on" && !configured) return null;

  return (
    <button type="button" className={compact?"customer-push-inline":"customer-engage-fab customer-push-fab"} onClick={()=>void(status==="on"?disable():enable())} disabled={busy} aria-label={status==="on"?"غیرفعال‌کردن اعلان‌ها":"فعال‌سازی اعلان‌ها"}>
      {status==="on"?<BellRing size={17}/>:<BellOff size={17}/>}
      {compact?<span>{status==="on"?"اعلان‌ها روشن است":"فعال‌سازی اعلان‌ها"}</span>:null}
    </button>
  );
}
