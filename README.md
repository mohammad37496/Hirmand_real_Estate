# هیرمند | Hirmand Real Estate

وب‌سایت RTL فارسی گروه مشاورین املاک هیرمند در اصفهان؛ با تمرکز روی تجربه کاربری سریع، تماس مستقیم، درخواست ملک، ابزارهای مالی و اطلاعات محله‌ها.

## امکانات

- معرفی خدمات خرید، فروش، رهن و اجاره
- فرم درخواست ملک با انتخاب نوع معامله، ملک، محله و مشاور
- تماس مستقیم، واتساپ، تلگرام و شبکه‌های اجتماعی
- نقشه و لینک سریع Google Maps، بلد و نشان
- ابزار تبدیل رهن و اجاره، کمیسیون و محاسبه وام/سود
- صفحه کد رهگیری برای مسیر توسعه آینده
- SEO پایه شامل canonical، Open Graph، Twitter Card، sitemap و structured data
- طراحی واکنش‌گرا و RTL با پشتیبانی از reduced motion

## Stack

React 19 · TanStack Router/Start · Vite · Tailwind CSS 4 · TypeScript · Lucide · Nitro/Vercel

## Deploy on Vercel

ریپو را در Vercel ایمپورت کنید و Build Command را روی `npm run build` بگذارید. در صورت نیاز به قابلیت‌های احراز هویت/دیتابیس، متغیرهای محیطی مربوط به همان سرویس‌ها را در Vercel تنظیم کنید؛ سایت معرفی اصلی بدون وابستگی به API خارجی قابل ارائه است.

## ساختار اصلی

- `src/routes/` — مسیرهای صفحه
- `src/components/hirmand/` — رابط کاربری برند هیرمند
- `src/lib/site.ts` — محتوا، اطلاعات تماس، محله‌ها و structured data
- `public/images/` — تصاویر و هویت بصری
- `public/sitemap.xml` — نقشه سایت
