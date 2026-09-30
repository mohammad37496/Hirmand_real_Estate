import { Database,Download,ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AdminBackupManager(){
  const [busy,setBusy]=useState(false);
  async function backup(){
    if(busy)return;
    setBusy(true);
    try{
      const res=await fetch("/api/admin-backup",{
        method:"GET",
        credentials:"same-origin",
        headers:{"accept":"application/json"},
      });
      if(!res.ok){
        const data=await res.json().catch(()=>({}));
        throw new Error(data?.statusMessage||"ساخت نسخه پشتیبان انجام نشد.");
      }
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download="hirmand-admin-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a);a.click();a.remove();
      URL.revokeObjectURL(url);
      toast.success("نسخه پشتیبان دانلود شد.");
    }catch(e){toast.error(e instanceof Error?e.message:"ساخت نسخه پشتیبان انجام نشد.");}
    finally{setBusy(false);}
  }
  return <div className="admin-backup-page">
    <section className="admin-panel admin-backup-hero">
      <span className="admin-backup-icon"><ShieldCheck size={28}/></span>
      <div><span className="kicker">امنیت و پشتیبان‌گیری</span><h2>نسخه پشتیبان از اطلاعات مدیریتی</h2><p>یک فایل JSON از اطلاعات اصلی فایل‌ها، درخواست‌ها، فعالیت‌های CRM، امور مالی، مشاوران و حضور و غیاب تهیه می‌شود. این فایل را در محل امن نگهداری کنید.</p></div>
      <button className="btn-gold" type="button" onClick={()=>void backup()} disabled={busy}><Download size={17}/>{busy?"در حال آماده‌سازی…":"دانلود نسخه پشتیبان"}</button>
    </section>
    <section className="admin-panel admin-backup-info">
      <Database size={22}/>
      <div><strong>توجه</strong><p>نسخه پشتیبان شامل اطلاعات خصوصی مدیریتی است؛ آن را در فضای عمومی یا برای افراد غیرمجاز ارسال نکنید.</p></div>
    </section>
  </div>
}
