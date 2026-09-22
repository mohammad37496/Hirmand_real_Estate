import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SITE } from "@/lib/site";
import appCss from "../styles.css?url";
import propertiesProCss from "../properties-pro.css?url";
import themeProCss from "../theme-pro.css?url";
import themeProPagesCss from "../theme-pro-pages.css?url";
import mobileCss from "../mobile.css?url";
import refinementsCss from "../refinements.css?url";
import uiClarityCss from "../ui-clarity.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: SITE.title },
      { name: "description", content: SITE.description },
      { name: "theme-color", content: "#0b1a2b" },
      { name: "color-scheme", content: "light" },
      { name: "author", content: SITE.nameFa },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { name: "format-detection", content: "telephone=yes" },
      { name: "application-name", content: SITE.shortName },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: SITE.shortName },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: propertiesProCss },
      { rel: "stylesheet", href: themeProCss },
      { rel: "stylesheet", href: themeProPagesCss },
      { rel: "stylesheet", href: mobileCss },
      { rel: "stylesheet", href: refinementsCss },
      { rel: "stylesheet", href: uiClarityCss },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
});

function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA support is optional and must never affect navigation.
    });
  }, []);
  return null;
}

function RootDocument() {
  return (
    <html lang="fa" dir="rtl" className="js antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PwaRegistrar />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}


function NotFoundPage() {
  return (
    <main className="property-not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">صفحه موردنظر پیدا نشد</h1>
      <p>این فایل ممکن است حذف شده باشد یا دیگر برای نمایش عمومی در دسترس نباشد.</p>
      <Link to="/" className="btn-gold">بازگشت به صفحه اصلی</Link>
    </main>
  );
}
