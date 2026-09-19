import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Phone } from "lucide-react";
import { BrandLogo } from "@/components/hirmand/logo";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { SITE } from "@/lib/site";
import { trackingHead } from "@/lib/seo";

export const Route = createFileRoute("/tracking")({
  component: TrackingPage,
  head: () => trackingHead(),
});

function TrackingPage() {
  return (
    <SiteChrome className="soon-shell">
      <section className="soon-page" id="top">
        <BrandLogo size="soon" />
        <p className="kicker">سامانه قرارداد</p>
        <h1>به زودی</h1>
        <p className="soon-title">ثبت قرارداد در سامانه و دریافت کد رهگیری</p>
        <p className="soon-text">
          این بخش در حال آماده‌سازی است. به‌زودی می‌توانید قرارداد را از همین‌جا در سامانه ثبت کنید
          و کد رهگیری دریافت نمایید.
        </p>
        <p className="soon-managed">{SITE.managedBy}</p>
        <div className="soon-actions">
          <Link to="/" className="btn-gold">
            <ArrowRight size={16} />
            بازگشت به صفحه اصلی
          </Link>
          <a className="btn-ghost" href={`tel:${SITE.phone.mobile}`}>
            <Phone size={16} />
            تماس با دفتر
          </a>
        </div>
      </section>
    </SiteChrome>
  );
}
