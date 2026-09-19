# گروه مشاورین املاک هیرمند | Hirmand Real Estate

وب‌سایت رسمی **گروه مشاورین املاک هیرمند** در اصفهان.  
طراحی RTL فارسی، سریع، واکنش‌گرا و آمادهٔ دیپلوی روی Vercel.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## امکانات

| بخش | توضیح |
|-----|--------|
| **خدمات** | خرید · فروش · رهن · اجاره |
| **فرم درخواست** | انتخاب نوع معامله، ملک، محله و مشاور |
| **تماس مستقیم** | تماس، واتساپ، تلگرام، ایتا و اینستاگرام |
| **نقشه** | لینک سریع Google Maps، بلد و نشان + embed |
| **ابزار مالی** | تبدیل رهن/اجاره، محاسبه کمیسیون، وام و سود سپرده |
| **فایل‌های ملکی** | لیست عمومی + صفحه جزئیات + پنل ادمین |
| **SEO** | Canonical، Open Graph، Twitter Card، Sitemap، Structured Data |
| **دسترسی‌پذیری** | RTL کامل، پشتیبانی `prefers-reduced-motion` |

---

## Stack

- **Frontend:** React 19 · TanStack Router / Start · Vite 8 · TypeScript
- **UI:** Tailwind CSS 4 · Lucide · Vazirmatn · Sonner
- **Data:** PostgreSQL / Neon (اختیاری) · Kysely · PGlite (لوکال)
- **Deploy:** Nitro · Vercel

---

## شروع سریع

```bash
# کلون
git clone https://github.com/mohammad37496/Hirmand_real_Estate.git
cd Hirmand_real_Estate

# نصب
npm install

# اجرا در حالت توسعه (پورت 8080)
npm run dev
```

سایت روی `http://localhost:8080` باز می‌شود.

---

## متغیرهای محیطی

فایل `.env.example` را کپی کنید:

```bash
cp .env.example .env
```

| متغیر | توضیح | اجباری |
|-------|--------|--------|
| `DATABASE_URL` | اتصال PostgreSQL / Neon برای ذخیره فایل‌های ملک | برای پنل ادمین |
| `HIRMAND_ADMIN_KEY` | کلید دسترسی به `/admin` | برای پنل ادمین |
| `VITE_SITE_URL` | آدرس نهایی سایت (برای SEO و sitemap) | توصیه می‌شود |
| `VITE_AUTH_ENABLED` | فعال‌سازی لایه احراز هویت (پیش‌فرض `false`) | خیر |

---

## دیپلوی روی Vercel

1. ریپو را در [Vercel](https://vercel.com) ایمپورت کنید.
2. **Build Command:** `npm run build`
3. متغیرهای `DATABASE_URL` و `HIRMAND_ADMIN_KEY` را در تنظیمات Environment Variables قرار دهید.
4. دامنهٔ دلخواه را متصل کنید و `VITE_SITE_URL` را روی همان دامنه تنظیم کنید.

سایت معرفی اصلی **بدون دیتابیس** هم کار می‌کند؛ فقط بخش فایل‌های ملکی و پنل ادمین به `DATABASE_URL` نیاز دارد.

---

## ساختار پروژه

```
src/
├── components/hirmand/   # کامپوننت‌های برند هیرمند
├── lib/
│   ├── site.ts           # محتوا، تماس، محله‌ها، JSON-LD
│   ├── properties.ts     # منطق فایل‌های ملکی
│   └── ...
├── routes/               # صفحات (TanStack file-based routing)
public/
├── images/               # تصاویر و لوگوی برند
├── sitemap.xml
└── robots.txt
migrations/               # اسکیمای دیتابیس
```

---

## پنل مدیریت فایل‌ها

- آدرس: `/admin`
- قابلیت‌ها: افزودن، ویرایش، انتشار، پیش‌نویس، ویژه‌کردن و حذف فایل
- احراز هویت با کلید سرور `HIRMAND_ADMIN_KEY` (hard-code نشده)

> تصاویر فعلاً با URL ثبت می‌شوند. مرحلهٔ بعدی می‌تواند آپلود مستقیم به Vercel Blob + تولید خودکار WebP/AVIF باشد.

---

## اسکریپت‌ها

| دستور | کار |
|-------|-----|
| `npm run dev` | سرور توسعه |
| `npm run build` | بیلد production + مایگریشن |
| `npm run typecheck` | بررسی TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## لایسنس

MIT © گروه مشاورین املاک هیرمند

---

**تماس دفتر:**  
اصفهان، سه راه سیمین، خیابان جانبازان، بلوار شهید بخشی  
موبایل: ۰۹۱۳ ۱۰۵ ۶۰۲۹ · دفتر: ۰۳۱ ۳۷۸۵ ۰۶۱۵
