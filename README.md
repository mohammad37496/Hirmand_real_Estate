# املاک هیرمند | Hirmand Real Estate

وب‌سایت رسمی **گروه مشاورین املاک هیرمند** در اصفهان؛ برای خرید، فروش، رهن و اجاره ملک.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## امکانات کلیدی

| بخش | توضیح |
|-----|--------|
| **Theme برند** | طراحی RTL با هویت Obsidian + Teal + Champagne و کنتراست مدرن |
| **خدمات** | خرید · فروش · رهن · اجاره |
| **فرم درخواست** | ثبت Lead واقعی در PostgreSQL + ارسال واتساپ |
| **CRM** | وضعیت Lead، منبع جذب، پیگیری سررسیدشده و پیگیری‌های آینده |
| **فایل‌های ملکی** | `/properties` + جستجو، فیلتر، مرتب‌سازی، صفحه جزئیات، مقایسه و علاقه‌مندی |
| **قیمت** | تشخیص کاهش قیمت و نمایش Badge کاهش قیمت روی فایل |
| **پیشنهاد هوشمند** | نمایش فایل‌های اخیراً دیده‌شده + دستیار تولید متن آگهی در پنل |
| **آنالیتیکس داخلی** | بازدید روزانه، بازدید یکتا، صفحات پربازدید، فایل‌های پربازدید، رویدادها و منابع جذب |
| **محله‌ها** | صفحات اختصاصی `/areas/:slug` برای محله‌های اصفهان با محتوای قابل ایندکس |
| **نقشه** | Google Maps، بلد، نشان و OpenStreetMap |
| **ابزارهای مالی** | تبدیل رهن/اجاره، محاسبه کمیسیون، وام و سود سپرده |
| **SEO** | Canonical، Open Graph، Structured Data، صفحات محله، Sitemap داینامیک و robots.txt |
| **دسترسی‌پذیری** | RTL کامل، Vazirmatn، skip link و پشتیبانی `prefers-reduced-motion` |
| **PWA** | Manifest، نصب‌پذیری و تجربه موبایل |\n| **چاپ فایل** | نسخه چاپی تمیز برای ذخیره/پرینت مشخصات ملک |\n| **Admin Pro** | فیلتر چندگانه فایل‌ها، مرتب‌سازی و امتیاز کیفیت آگهی |

---

## Stack

- **Frontend:** React 19 · TanStack Router / Start · Vite 8 · TypeScript
- **UI:** Tailwind CSS 4 · Lucide · Vazirmatn · Sonner
- **Data:** PostgreSQL / Neon (اختیاری) · PGlite (لوکال)
- **Deploy:** Nitro · Vercel

---

## شروع سریع

```bash
git clone https://github.com/mohammad37496/Hirmand_real_Estate.git
cd Hirmand_real_Estate
npm install
npm run dev
```

سایت روی `http://localhost:8080` اجرا می‌شود.

## متغیرهای محیطی

| متغیر | توضیح | اجباری |
|-------|--------|--------|
| `DATABASE_URL` | اتصال PostgreSQL / Neon برای فایل‌ها، Leadها و Analytics | برای امکانات دیتابیسی |
| `HIRMAND_ADMIN_KEY` | کلید دسترسی به `/admin` | برای پنل ادمین |
| `VITE_SITE_URL` | آدرس نهایی و canonical سایت، ترجیحاً `https://hirmand.ir` | بسیار مهم |
| `VITE_GOOGLE_SITE_VERIFICATION` | توکن تأیید Google Search Console | اختیاری |
| `VITE_AUTH_ENABLED` | فعال‌سازی Better Auth | خیر |

## SEO و Google

زیرساخت SEO پروژه برای برند **«املاک هیرمند»** روی نام برند + موقعیت جغرافیایی + صفحات خدمات و محله‌ها متمرکز شده است.

- عنوان و H1 صفحه اصلی شامل «املاک هیرمند» است.
- Structured Data شامل `RealEstateAgent` / `LocalBusiness`، `WebSite` و `SearchAction` است.
- هر محله صفحه مستقل با عنوان، توضیحات، Canonical و Structured Data دارد.
- Sitemap در `/sitemap.xml` به‌صورت داینامیک ساخته می‌شود و فایل‌های منتشرشده ملک را هم اضافه می‌کند.
- `robots.txt` پنل مدیریت را از ایندکس‌شدن خارج می‌کند.
- صفحات عمومی با لینک‌های قابل crawl در دسترس هستند.
- توکن Search Console از طریق `VITE_GOOGLE_SITE_VERIFICATION` قابل تزریق به `<head>` صفحه اصلی است.

### کارهای لازم برای Google

1. دامنه `hirmand.ir` را به Vercel وصل کنید و `VITE_SITE_URL=https://hirmand.ir` تنظیم باشد.
2. سایت را در Google Search Console تأیید کنید و `https://hirmand.ir/sitemap.xml` را Submit کنید.
3. برای صفحه اصلی و صفحات کلیدی Request Indexing بزنید.
4. Google Business Profile / Google Maps را با نام، تلفن و آدرس واقعی کسب‌وکار تکمیل و تأیید کنید.
5. محتوای واقعی و مفید برای محله‌ها و خدمات اضافه کنید و لینک‌های طبیعی و معتبر بسازید.

> **نکته:** هیچ کدی رتبه ۱ گوگل را تضمین نمی‌کند. هدف این تغییرات، تقویت سیگنال‌های فنی، محتوایی و محلی برای جست‌وجوی «املاک هیرمند» است.

## مسیرهای اصلی

```text
/                       صفحه اصلی
/properties             فهرست فایل‌ها
/properties/:slug       جزئیات هر ملک
/areas/:slug            صفحه اختصاصی محله
/compare                مقایسه فایل‌ها
/favorites              علاقه‌مندی‌ها
/admin                  پنل مدیریت
/tracking               بخش قرارداد (فعلاً noindex)
```

## پنل مدیریت

- افزودن، ویرایش، انتشار، پیش‌نویس، ویژه‌کردن و حذف فایل
- آپلود رسانه به Vercel Blob
- مدیریت Leadها و وضعیت پیگیری
- مشاهده آمار بازدید روزانه و بازدید یکتا
- صفحات پربازدید و فایل‌های پربازدید
- منابع جذب، رویدادها و عملکرد Lead
- موسیقی و رسانه‌های سایت

## اسکریپت‌ها

| دستور | کار |
|-------|-----|
| `npm run dev` | سرور توسعه |
| `npm run build` | بیلد production + migration |
| `npm run typecheck` | بررسی TypeScript |
| `npm run lint` | ESLint |
| `npm test` | اجرای تست‌ها |
| `npm run format` | Prettier |

## ساختار پروژه

```text
src/
├── components/hirmand/   # برند و UI
├── lib/
│   ├── site.ts            # برند، تماس، محله‌ها، JSON-LD
│   ├── seo.ts             # meta/canonical/Open Graph/Structured Data
│   ├── properties.ts      # دیتای فایل‌های ملکی
│   └── analytics.ts       # رویدادهای آنالیتیکس
├── routes/                # مسیرهای TanStack
server/
├── routes/api/            # APIهای Lead، Analytics، Upload و Admin
└── routes/sitemap.xml.ts  # sitemap داینامیک
public/
├── images/                # تصاویر برند
├── manifest.webmanifest
├── robots.txt
└── og.jpg
migrations/                # migrationهای PostgreSQL
```

## توسعه

قبل از push پیشنهاد می‌شود:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## لایسنس

MIT © گروه مشاورین املاک هیرمند

**دفتر:** اصفهان، سه راه سیمین، خیابان جانبازان، بلوار شهید بخشی  
**موبایل:** ۰۹۱۳ ۱۰۵ ۶۰۲۹ · **دفتر:** ۰۳۱ ۳۷۸۵ ۰۶۱۵
