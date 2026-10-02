import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCookie } from "@tanstack/react-start/server";
import { dbSource, getSql } from "@/lib/db";
import { FAQS } from "@/lib/site";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertAdminServerFnOrigin } from "@/lib/admin-server-fn-guard.server";

export type GuideContent = {
  id:string; category:string; title:string; summary:string; points:string[]; sortOrder:number; active:boolean;
};
export type FaqContent = { id:string; question:string; answer:string; category:string; sortOrder:number; active:boolean };

export const DEFAULT_GUIDES:GuideContent[]=[
  {id:"before-buy",sortOrder:0,active:true,category:"خرید",title:"قبل از خرید ملک چه چیزهایی را بررسی کنیم؟",summary:"یک چک‌لیست عملی برای اینکه تصمیم خرید فقط بر اساس ظاهر و قیمت آگهی نباشد.",points:["نیاز خودتان را قبل از بازدید مشخص کنید: متراژ، تعداد خواب، پارکینگ، آسانسور و محدوده.","شرایط ملک را از نزدیک بررسی کنید؛ نور، صدا، دسترسی، کیفیت مشاعات و وضعیت نگهداری را جداگانه ببینید.","مدارک و وضعیت حقوقی ملک را قبل از هر تعهد مالی با دقت بررسی و درباره موارد مبهم از متخصص مربوطه سؤال کنید.","قیمت را با چند فایل مشابه در همان محدوده مقایسه کنید، نه فقط یک آگهی."]},
  {id:"selling",sortOrder:10,active:true,category:"فروش",title:"برای فروش سریع‌تر، فایل ملک را چطور آماده کنیم؟",summary:"اقدام‌های ساده‌ای که کیفیت ارائه فایل را بهتر می‌کنند و تصمیم‌گیری خریدار را آسان‌تر می‌سازند.",points:["فضا را قبل از عکاسی مرتب و روشن کنید و از چند زاویه مهم عکس بگیرید.","متراژ، تعداد خواب، پارکینگ، انباری، آسانسور و وضعیت بازسازی را شفاف و یکدست ثبت کنید.","قیمت را با فایل‌های نزدیک همان محله و ویژگی‌ها مقایسه کنید.","زمان‌های مناسب برای بازدید و شرایط مذاکره را از ابتدا مشخص کنید تا رفت‌وبرگشت کمتر شود."]},
  {id:"rent",sortOrder:20,active:true,category:"رهن و اجاره",title:"در رهن و اجاره چه نکاتی را کنار هم بسنجیم؟",summary:"فقط مبلغ رهن یا اجاره را نبینید؛ ترکیب مالی و شرایط واقعی ملک را با هم مقایسه کنید.",points:["چند ترکیب رهن و اجاره را با یک نرخ تبدیل ثابت با هم مقایسه کنید.","هزینه‌های جانبی، شارژ و شرایط پرداخت را در کنار مبلغ اصلی بررسی کنید.","وضعیت پارکینگ، انباری، آسانسور و زمان تحویل را حتماً در مقایسه نگه دارید.","اگر فایل قابل تبدیل است، سناریوهای مختلف را قبل از تصمیم نهایی کنار هم ببینید."]},
  {id:"compare",sortOrder:30,active:true,category:"تصمیم‌گیری",title:"چطور دو فایل ملکی را منصفانه مقایسه کنیم؟",summary:"برای مقایسه واقعی، شاخص‌ها را یکسان کنید و تفاوت‌های مهم را جدا ببینید.",points:["قیمت کل به‌تنهایی کافی نیست؛ قیمت هر متر را هم بررسی کنید.","متراژ، تعداد خواب، طبقه، جهت، پارکینگ، آسانسور و انباری را در یک جدول کنار هم قرار دهید.","موقعیت محله و کیفیت دسترسی را جدا از مشخصات داخل ساختمان ارزیابی کنید.","اگر دو فایل از نظر قیمت نزدیک‌اند، شرایط معامله و وضعیت سند می‌تواند تفاوت اصلی را ایجاد کند."]},
  {id:"visit",sortOrder:40,active:true,category:"بازدید",title:"در بازدید ملک چه چیزهایی را یادداشت کنیم؟",summary:"یک قالب ساده برای اینکه بعد از چند بازدید، جزئیات فایل‌ها با هم قاطی نشوند.",points:["نورگیری، صدا، بوی نامطبوع، کیفیت نما و مشاعات را همان‌جا یادداشت کنید.","ابعاد اتاق‌ها و فضای پارک خودرو را با نیاز واقعی خودتان تطبیق دهید.","سؤال‌های مهم درباره زمان تخلیه، شرایط پرداخت، هزینه‌های ساختمان و وضعیت تعمیرات را ثبت کنید.","در پایان بازدید سه نکته مثبت، سه نکته منفی و یک سؤال باز باقی‌مانده را بنویسید."]},
  {id:"neighborhood",sortOrder:50,active:true,category:"محله",title:"برای انتخاب محله چه معیارهایی مهم است؟",summary:"انتخاب محله فقط به قیمت هر متر محدود نمی‌شود و باید با سبک زندگی شما جور باشد.",points:["فاصله تا محل کار، مدرسه، مراکز خرید و مسیرهای اصلی را با زمان واقعی رفت‌وآمد بسنجید.","در ساعات مختلف روز، سطح شلوغی، صدای محیط و جای پارک را بررسی کنید.","به امکانات اطراف و کیفیت دسترسی پیاده و خودرو توجه کنید.","برای سرمایه‌گذاری و سکونت، اولویت معیارها ممکن است متفاوت باشد؛ هدف خودتان را از ابتدا مشخص کنید."]}
];

export const DEFAULT_FAQS:FaqContent[]=FAQS.map((item,index)=>({
  id:`faq-${index+1}`,question:item.q,answer:item.a,category:"عمومی",sortOrder:index*10,active:true
}));

async function requireAdmin(){
  if(!(await verifyAdminSessionToken(getCookie(ADMIN_SESSION_COOKIE)))) throw new Error("نشست مدیریت معتبر نیست.");
  assertAdminServerFnOrigin();
}

function text(value:unknown){return String(value??"").trim();}
function bodyRecord(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function mapGuide(row:Record<string,unknown>):GuideContent{
  const body=bodyRecord(row.body); const raw=Array.isArray(body.points)?body.points:[];
  return {id:text(row.id),category:text(row.category),title:text(row.title),summary:text(row.summary),points:raw.map(text).filter(Boolean),sortOrder:Number(row.sort_order)||0,active:row.active==null?true:Boolean(row.active)};
}
function mapFaq(row:Record<string,unknown>):FaqContent{
  const body=bodyRecord(row.body);
  return {id:text(row.id),category:text(row.category)||"عمومی",question:text(row.title),answer:text(body.answer),sortOrder:Number(row.sort_order)||0,active:row.active==null?true:Boolean(row.active)};
}

async function ensureSeeded(){
  if(dbSource==="unconfigured") return;
  const sql=await getSql();
  const countRows=await sql.query<{count:number}>("select count(*)::int as count from site_content_items");
  if(Number(countRows[0]?.count)>0) return;
  const items=[
    ...DEFAULT_GUIDES.map((item,index)=>({id:item.id,kind:"guide",category:item.category,title:item.title,summary:item.summary,body:{points:item.points},sortOrder:index*10})),
    ...DEFAULT_FAQS.map((item,index)=>({id:item.id,kind:"faq",category:item.category,title:item.question,summary:"",body:{answer:item.answer},sortOrder:index*10})),
  ];
  const values=items.map((_,i)=>`(${i*7+1},${i*7+2},${i*7+3},${i*7+4},${i*7+5},${i*7+6},${i*7+7},true)`).join(",");
  const params:unknown[]=[];
  for(const item of items) params.push(item.id,item.kind,item.category,item.title,item.summary,JSON.stringify(item.body),item.sortOrder);
  await sql.query(
    `insert into site_content_items(id,kind,category,title,summary,body,sort_order,active) values ${values}
     on conflict(id) do nothing`,params
  );
}

export const getPublicGuides=createServerFn({method:"GET"}).handler(async()=>{
  if(dbSource==="unconfigured") return DEFAULT_GUIDES;
  try{
    await ensureSeeded(); const sql=await getSql();
    const rows=await sql.query<Record<string,unknown>>(
      "select id,category,title,summary,body,sort_order,active from site_content_items where kind='guide' and active=true order by sort_order asc,updated_at desc");
    const items=rows.map(mapGuide).filter(item=>item.id&&item.title&&item.points.length);
    return items.length?items:DEFAULT_GUIDES;
  }catch{return DEFAULT_GUIDES;}
});

export const getPublicFaqs=createServerFn({method:"GET"}).handler(async()=>{
  if(dbSource==="unconfigured") return DEFAULT_FAQS;
  try{
    await ensureSeeded(); const sql=await getSql();
    const rows=await sql.query<Record<string,unknown>>(
      "select id,category,title,body,sort_order,active from site_content_items where kind='faq' and active=true order by sort_order asc,updated_at desc");
    const items=rows.map(mapFaq).filter(item=>item.id&&item.question&&item.answer);
    return items.length?items:DEFAULT_FAQS;
  }catch{return DEFAULT_FAQS;}
});

export const listAdminSiteContent=createServerFn({method:"POST"}).validator(z.object({kind:z.enum(["guide","faq"]).optional()})).handler(async({data})=>{
  await requireAdmin();
  if(dbSource==="unconfigured") return {guides:DEFAULT_GUIDES,faqs:DEFAULT_FAQS};
  await ensureSeeded(); const sql=await getSql();
  const rows=await sql.query<Record<string,unknown>>(
    `select id,kind,category,title,summary,body,sort_order,active,updated_at
     from site_content_items
     where ($1::text='' or kind=$1)
     order by kind asc,sort_order asc,updated_at desc`,[data.kind??""]
  );
  return {
    guides:rows.filter(r=>r.kind==="guide").map(mapGuide),
    faqs:rows.filter(r=>r.kind==="faq").map(mapFaq),
  };
});

export const upsertAdminSiteContent=createServerFn({method:"POST"}).validator(z.object({
  id:z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  kind:z.enum(["guide","faq"]),
  category:z.string().trim().max(80).default("عمومی"),
  title:z.string().trim().min(3).max(220),
  summary:z.string().trim().max(500).default(""),
  answer:z.string().trim().max(4000).default(""),
  points:z.array(z.string().trim().min(1).max(700)).max(12).default([]),
  sortOrder:z.number().int().min(-10000).max(10000).default(0),
  active:z.boolean().default(true),
})).handler(async({data})=>{
  await requireAdmin(); if(dbSource==="unconfigured") throw new Error("پایگاه داده تنظیم نشده است.");
  const id=data.id??`${data.kind}-${Date.now().toString(36)}`;
  if(data.kind==="guide" && !data.points.length) throw new Error("راهنما حداقل باید یک نکته داشته باشد.");
  if(data.kind==="faq" && !data.answer) throw new Error("پاسخ پرسش را وارد کنید.");
  const body=data.kind==="guide"?JSON.stringify({points:data.points}):JSON.stringify({answer:data.answer});
  const sql=await getSql();
  const rows=await sql.query<Record<string,unknown>>(
    `insert into site_content_items(id,kind,category,title,summary,body,sort_order,active,updated_at)
     values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,current_timestamp)
     on conflict(id) do update set kind=excluded.kind,category=excluded.category,title=excluded.title,summary=excluded.summary,body=excluded.body,sort_order=excluded.sort_order,active=excluded.active,updated_at=current_timestamp
     returning id,kind,category,title,summary,body,sort_order,active,updated_at`,
    [id,data.kind,data.category,data.title,data.summary,body,data.sortOrder,data.active]
  );
  return data.kind==="guide"?mapGuide(rows[0]!):mapFaq(rows[0]!);
});

export const deleteAdminSiteContent=createServerFn({method:"POST"}).validator(z.object({id:z.string().trim().min(2).max(80)})).handler(async({data})=>{
  await requireAdmin(); if(dbSource==="unconfigured") return {success:true};
  const sql=await getSql(); await sql.query("delete from site_content_items where id=$1",[data.id]); return {success:true};
});

export function buildFaqJsonLd(faqs:FaqContent[]){
  return {"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))};
}
