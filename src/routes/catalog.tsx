import { createFileRoute } from "@tanstack/react-router";
import { Printer, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listPublishedPropertiesBySlugs, type Property } from "@/lib/properties";
import { SITE } from "@/lib/site";
import { formatToman } from "@/lib/money";
import "@/property-catalog.css";

const KEY="hirmand-compare-properties";
const MAX=12;
const tx:Record<string,string>={buy:"خرید",sell:"فروش",rent:"اجاره",mortgage:"رهن"};

function readItems(){
  const params=new URLSearchParams(window.location.search);
  const raw=params.get("items")||localStorage.getItem(KEY)||"[]";
  try{
    const parsed: unknown = raw.startsWith("[") ? JSON.parse(raw) : raw.split(",");
    const values = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    return Array.from(new Set(values.map((x) => x.trim()).filter(Boolean))).slice(0, MAX);
  }catch{return [] as string[];}
}
function primaryPrice(p:Property){const value=p.transactionType==="rent"?p.rent:p.transactionType==="mortgage"?p.deposit:p.price;return value?formatToman(Number(value))+" تومان":"تماس برای قیمت";}

export const Route=createFileRoute("/catalog")({
  head:()=>({meta:[
    {title:"کاتالوگ فایل‌ها | "+SITE.nameFa},
    {name:"description",content:"کاتالوگ چاپی فایل‌های منتخب املاک هیرمند."},
    {name:"robots",content:"noindex,nofollow"},
  ]}),
  component:CatalogPage,
});

function CatalogPage(){
  const [items,setItems]=useState<Property[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    void listPublishedPropertiesBySlugs({data:{slugs:readItems()}}).then(setItems).catch(()=>setItems([])).finally(()=>setLoading(false));
  },[]);
  function share(){
    const url=window.location.href;
    if(navigator.share)void navigator.share({title:"کاتالوگ فایل‌های هیرمند",url});
    else if(navigator.clipboard)void navigator.clipboard.writeText(url);
  }
  return <main className="property-catalog-page">
    <header className="property-catalog-header">
      <div><span className="kicker">HIRMAND REAL ESTATE</span><h1>کاتالوگ فایل‌های منتخب</h1><p>{items.length.toLocaleString("fa-IR")} فایل منتخب برای چاپ یا ذخیره به PDF آماده است.</p></div>
      <div className="property-catalog-actions"><button className="btn-gold" type="button" onClick={()=>window.print()}><Printer size={16}/>چاپ / ذخیره PDF</button><button className="btn-ghost" type="button" onClick={share}><Share2 size={16}/>اشتراک‌گذاری</button></div>
    </header>
    {loading?<section className="property-catalog-empty">در حال آماده‌سازی کاتالوگ…</section>:items.length?<section className="property-catalog-list">{items.map((p,index)=><article className="property-catalog-sheet" key={p.id}>
      <div className="property-catalog-brand"><strong>املاک هیرمند</strong><span>کد {p.id.slice(0,8)}</span></div>
      {p.images[0]?<img src={p.images[0]} alt="" loading="lazy"/>:<div className="property-catalog-placeholder"/>}
      <div className="property-catalog-copy"><span className="property-catalog-index">فایل {index.toLocaleString("fa-IR")}</span><h2>{p.title}</h2><p>{tx[p.transactionType]||p.transactionType} · {p.neighborhood}{p.areaM2?" · "+p.areaM2.toLocaleString("fa-IR")+" متر":""}{p.bedrooms!=null?" · "+p.bedrooms.toLocaleString("fa-IR")+" خواب":""}</p><strong>{primaryPrice(p)}</strong><div className="property-catalog-specs"><span>{p.parking?"پارکینگ دارد":"بدون پارکینگ"}</span><span>{p.elevator?"آسانسور دارد":"بدون آسانسور"}</span><span>{p.storage?"انباری دارد":"بدون انباری"}</span></div><a href={"/properties/"+encodeURIComponent(p.slug)}>مشاهده فایل در سایت</a></div>
    </article>)}</section>:<section className="property-catalog-empty"><strong>فایلی برای کاتالوگ پیدا نشد.</strong><a href="/compare" className="btn-gold">بازگشت به مقایسه</a></section>}
    <footer className="property-catalog-footer"><strong>{SITE.nameFa}</strong><span>{SITE.phone.mobileDisplay} · {SITE.phone.officeDisplay}</span><span>{SITE.url}</span></footer>
  </main>;
}