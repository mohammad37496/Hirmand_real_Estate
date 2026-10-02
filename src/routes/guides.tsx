import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle2, Search, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { SITE } from "@/lib/site";
import "@/guides.css";

type Guide = { id: string; category: string; title: string; summary: string; points: string[] };

const GUIDES: Guide[] = [
  { id: "before-buy", category: "خرید", title: "قبل از خرید ملک چه چیزهایی را بررسی کنیم؟", summary: "یک چک‌لیست عملی برای اینکه تصمیم خرید فقط بر اساس ظاهر و قیمت آگهی نباشد.", points: ["نیاز خودتان را قبل از بازدید مشخص کنید: متراژ، تعداد خواب، پارکینگ، آسانسور و محدوده.","شرایط ملک را از نزدیک بررسی کنید؛ نور، صدا، دسترسی، کیفیت مشاعات و وضعیت نگهداری را جداگانه ببینید.","مدارک و وضعیت حقوقی ملک را قبل از هر تعهد مالی با دقت بررسی و درباره موارد مبهم از متخصص مربوطه سؤال کنید.","قیمت را با چند فایل مشابه در همان محدوده مقایسه کنید، نه فقط یک آگهی."] },
  { id: "selling", category: "فروش", title: "برای فروش سریع‌تر، فایل ملک را چطور آماده کنیم؟", summary: "اقدام‌های ساده‌ای که کیفیت ارائه فایل را بهتر می‌کنند و تصمیم‌گیری خریدار را آسان‌تر می‌سازند.", points: ["فضا را قبل از عکاسی مرتب و روشن کنید و از چند زاویه مهم عکس بگیرید.","متراژ، تعداد خواب، پارکینگ، انباری، آسانسور و وضعیت بازسازی را شفاف و یکدست ثبت کنید.","قیمت را با فایل‌های نزدیک همان محله و ویژگی‌ها مقایسه کنید.","زمان‌های مناسب برای بازدید و شرایط مذاکره را از ابتدا مشخص کنید تا رفت‌وبرگشت کمتر شود."] },
  { id: "rent", category: "رهن و اجاره", title: "در رهن و اجاره چه نکاتی را کنار هم بسنجیم؟", summary: "فقط مبلغ رهن یا اجاره را نبینید؛ ترکیب مالی و شرایط واقعی ملک را با هم مقایسه کنید.", points: ["چند ترکیب رهن و اجاره را با یک نرخ تبدیل ثابت با هم مقایسه کنید.","هزینه‌های جانبی، شارژ و شرایط پرداخت را در کنار مبلغ اصلی بررسی کنید.","وضعیت پارکینگ، انباری، آسانسور و زمان تحویل را حتماً در مقایسه نگه دارید.","اگر فایل قابل تبدیل است، سناریوهای مختلف را قبل از تصمیم نهایی کنار هم ببینید."] },
  { id: "compare", category: "تصمیم‌گیری", title: "چطور دو فایل ملکی را منصفانه مقایسه کنیم؟", summary: "برای مقایسه واقعی، شاخص‌ها را یکسان کنید و تفاوت‌های مهم را جدا ببینید.", points: ["قیمت کل به‌تنهایی کافی نیست؛ قیمت هر متر را هم بررسی کنید.","متراژ، تعداد خواب، طبقه، جهت، پارکینگ، آسانسور و انباری را در یک جدول کنار هم قرار دهید.","موقعیت محله و کیفیت دسترسی را جدا از مشخصات داخل ساختمان ارزیابی کنید.","اگر دو فایل از نظر قیمت نزدیک‌اند، شرایط معامله و وضعیت سند می‌تواند تفاوت اصلی را ایجاد کند."] },
  { id: "visit", category: "بازدید", title: "در بازدید ملک چه چیزهایی را یادداشت کنیم؟", summary: "یک قالب ساده برای اینکه بعد از چند بازدید، جزئیات فایل‌ها با هم قاطی نشوند.", points: ["نورگیری، صدا، بوی نامطبوع، کیفیت نما و مشاعات را همان‌جا یادداشت کنید.","ابعاد اتاق‌ها و فضای پارک خودرو را با نیاز واقعی خودتان تطبیق دهید.","سؤال‌های مهم درباره زمان تخلیه، شرایط پرداخت، هزینه‌های ساختمان و وضعیت تعمیرات را ثبت کنید.","در پایان بازدید سه نکته مثبت، سه نکته منفی و یک سؤال باز باقی‌مانده را بنویسید."] },
  { id: "neighborhood", category: "محله", title: "برای انتخاب محله چه معیارهایی مهم است؟", summary: "انتخاب محله فقط به قیمت هر متر محدود نمی‌شود و باید با سبک زندگی شما جور باشد.", points: ["فاصله تا محل کار، مدرسه، مراکز خرید و مسیرهای اصلی را با زمان واقعی رفت‌وآمد بسنجید.","در ساعات مختلف روز، سطح شلوغی، صدای محیط و جای پارک را بررسی کنید.","به امکانات اطراف و کیفیت دسترسی پیاده و خودرو توجه کنید.","برای سرمایه‌گذاری و سکونت، اولویت معیارها ممکن است متفاوت باشد؛ هدف خودتان را از ابتدا مشخص کنید."] },
];

export const Route = createFileRoute("/guides")({
  head: () => {
    const title = "راهنمای خرید، فروش و اجاره ملک | " + SITE.nameFa;
    const description = "راهنمای کاربردی هیرمند برای خرید، فروش، رهن و اجاره ملک و آماده‌سازی برای بازدید و مقایسه فایل‌ها.";
    return { meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "index, follow" }], links: [{ rel: "canonical", href: SITE.url + "/guides" }] };
  },
  component: GuidesPage,
});

function GuidesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه");
  const [openId, setOpenId] = useState(GUIDES[0]!.id);
  const categories = useMemo(() => ["همه", ...Array.from(new Set(GUIDES.map((item) => item.category)))], []);
  const visible = useMemo(() => {
    const q = query.trim();
    return GUIDES.filter((item) => {
      const matchesCategory = category === "همه" || item.category === category;
      const haystack = [item.title, item.summary, item.category, ...item.points].join(" ");
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [category, query]);

  async function shareGuide(guide: Guide) {
    const url = new URL("/guides?guide=" + guide.id, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: guide.title, text: guide.summary, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast.success("لینک راهنما کپی شد."); }
      else window.prompt("لینک راهنما:", url);
    } catch {
      // Sharing can be cancelled by the visitor.
    }
  }

  return (
    <SiteChrome>
      <main className="guides-page">
        <header className="guides-hero"><div className="guides-hero-icon" aria-hidden="true"><BookOpen size={28} /></div><div><span className="kicker">مرکز راهنمای هیرمند</span><h1>راهنمای خرید، فروش و اجاره ملک</h1><p>مطالب کوتاه و کاربردی برای اینکه قبل از بازدید، مذاکره یا تصمیم نهایی بدانید چه چیزهایی را باید کنار هم ببینید.</p></div></header>
        <section className="guides-toolbar" aria-label="جستجوی راهنما"><label className="guides-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در راهنما..." /></label><div className="guides-categories">{categories.map((item) => <button key={item} type="button" className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></section>
        <section className="guides-list" aria-label="مطالب راهنما">{visible.length ? visible.map((guide) => { const open = openId === guide.id; return <article key={guide.id} className={"guide-card" + (open ? " is-open" : "")}><button type="button" className="guide-card-trigger" onClick={() => setOpenId(open ? "" : guide.id)} aria-expanded={open}><span className="guide-card-number">{String(GUIDES.indexOf(guide) + 1).padStart(2, "0")}</span><span className="guide-card-copy"><small>{guide.category}</small><strong>{guide.title}</strong><em>{guide.summary}</em></span><ArrowLeft size={18} className="guide-card-arrow" /></button>{open ? <div className="guide-card-body"><div className="guide-point-list">{guide.points.map((point) => <div key={point} className="guide-point"><CheckCircle2 size={17} /><p>{point}</p></div>)}</div><button type="button" className="btn-ghost guide-share" onClick={() => void shareGuide(guide)}><Share2 size={15} /> اشتراک راهنما</button></div> : null}</article>; }) : <div className="guides-empty"><Search size={25} /><strong>راهنمایی با این عبارت پیدا نشد.</strong><p>عبارت کوتاه‌تری جستجو کنید یا دسته‌بندی را روی «همه» بگذارید.</p></div>}</section>
        <section className="guides-cta"><div><span className="kicker">از راهنما به فایل واقعی</span><h2>حالا فایل‌های موجود را با همین معیارها بررسی کنید.</h2></div><a className="btn-gold" href="/properties">مشاهده فایل‌ها</a></section>
      </main>
    </SiteChrome>
  );
}