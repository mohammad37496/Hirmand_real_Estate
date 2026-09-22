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
| **Theme برند** | طراحی RTL با هویت Navy + Brass روی زمینه کاغذی، مقیاس تایپوگرافی و شعاع یکدست |
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
| **PWA** | Manifest، نصب‌پذیری و تجربه موبایل |
| **چاپ فایل** | نسخه چاپی تمیز برای ذخیره/پرینت مشخصات ملک |
| **Admin Pro** | فیلتر چندگانه فایل‌ها، مرتب‌سازی و امتیاز کیفیت آگهی |

---

## Stack

- **Frontend:** React 19 · TanStack Router / Start · Vite 8 · TypeScript
- **UI:** Tailwind CSS 4 · Lucide · Vazirmatn · Sonner
- **Data:** PostgreSQL / Neon (اختیاری) · PGlite (لوکال)
- **Deploy:** Nitro · Vercel

---

## طراحی و تم

تمام لایه بصری در `src/theme-pro.css` متمرکز است و `src/styles.css` فقط نقش پایه (reset و کامپوننت‌های قدیمی) را دارد.

- **رنگ:** Navy + Brass روی کاغذ گرم. Brass رنگ اصلی اکشن‌ها است (دکمه اصلی، دکمه هدر) و Navy رنگ ساختاری (تیتر، سطوح تیره).
- **تایپوگرافی:** همه اندازه‌های رابط روی یک مقیاس ۹پله‌ای (`--fs-2xs` … `--fs-2xl`) و سه اندازه تیتر (`--fs-h1` … `--fs-h3`) می‌نشینند؛ دیگر اندازه پرت و نیم‌پیکسلی در کامپوننت‌ها وجود ندارد.
- **شعاع و عمق:** فقط `--r-xs` … `--r-2xl` و سه سطح سایه `--el-1` … `--el-3`. هیچ شعاع hard-code شده‌ای باقی نمانده است.
- **کنتراست:** همه جفت‌های متن/پس‌زمینه حداقل WCAG AA (نسبت ۴٫۵:۱) را پاس می‌کنند.
- **دسترس‌پذیری لمسی:** کنترل‌های چیپ‌مانند (مقادیر سریع، دکمه تماس، دکمه کپی) حداقل ۴۴ پیکسل ارتفاع دارند.

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
| `VITE_SITE_URL` | آدرس نهایی و canonical سایت، ترجیحاً `https://www.hirmandrealestate.ir` | بسیار مهم |
| `VITE_GOOGLE_SITE_VERIFICATION` | توکن تأیید Google Search Console | اختیاری |
| `VITE_AUTH_ENABLED` | فعال‌سازی Better Auth | خیر |
| `BLOB_READ_WRITE_TOKEN` | فضای ذخیره‌سازی Vercel Blob برای رسانه‌های حجیم | اختیاری |

> آپلود آهنگ و رسانه بدون `BLOB_READ_WRITE_TOKEN` هم کار می‌کند: فایل‌ها در پایگاه داده
> ذخیره و از مسیر `/api/media/<id>` با پشتیبانی از Range (برای جابه‌جایی داخل آهنگ) سرو
> می‌شوند. با تنظیم این متغیر، فایل‌ها روی CDN قرار می‌گیرند و سقف حجم آپلود بالاتر می‌رود.

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

1. دامنه `www.hirmandrealestate.ir` را به Vercel وصل کنید و `VITE_SITE_URL=https://www.hirmandrealestate.ir` تنظیم باشد.
2. سایت را در Google Search Console تأیید کنید و `https://www.hirmandrealestate.ir/sitemap.xml` را Submit کنید.
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
/tracking               باشگاه همکاران، ثبت قرارداد و کد رهگیری (noindex)
```

## پنل مدیریت

- افزودن، ویرایش، انتشار، پیش‌نویس، ویژه‌کردن و حذف فایل
- آپلود رسانه و آهنگ با آپلود قطعه‌قطعه (نوار پیشرفت واقعی) و ذخیره‌سازی پایدار روی سرور
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


## باشگاه همکاران و کد رهگیری

سامانه `/tracking` اکنون یک پورتال واقعی برای دفاتر همکار دارد:
- حساب اختصاصی برای هر املاک با کد همکاری و PIN امن
- ثبت قرارداد و تولید کد رهگیری یکتا
- تأیید/رد قرارداد توسط مدیریت
- کارت دیجیتال ۱۲ مهر و محاسبه خودکار پاداش
- QR اختصاصی برای ورود سریع هر املاک
- چاپ کارت ۱۲ مهر از پنل مدیریت
- تاریخچه قراردادها، پاداش‌ها و لاگ عملیات مدیریتی
- قفل موقت حساب پس از چند ورود ناموفق
