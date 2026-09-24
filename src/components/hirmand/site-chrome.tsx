import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, FileKey, WalletCards } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { CallMenu } from "./call-menu";
import { Footer } from "./footer";
import { Header } from "./header";
import { scrollToId } from "./scroll";
import { VisitorTracker } from "./visitor-tracker";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { SiteUtilities } from "./site-utilities";

export function SiteChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <a className="skip-link" href="#top" onClick={(event) => scrollToId(event, "top")}>
        رفتن به محتوا
      </a>
      <Header />
      <VisitorTracker />
      <div className={cn("page", className)}>{children}</div>
      <Footer />
      <div className="quick-actions" aria-label="اقدام سریع">
        <Link to="/properties" className="quick-action">
          <FileKey size={17} />
          <span>فایل‌ها</span>
        </Link>
        <Link to="/" hash="inquiry" className="quick-action quick-action-primary" onClick={() => trackAnalyticsEvent("inquiry_click")}>
          <FileKey size={17} />
          <span>درخواست ملک</span>
        </Link>
        <Link
          to="/"
          hash="budget-match"
          className="quick-action"
          onClick={() => trackAnalyticsEvent("budget_match_click")}
        >
          <WalletCards size={17} />
          <span>بودجه‌یاب</span>
        </Link>
        <Link
          to="/"
          hash="tools"
          className="quick-action"
          onClick={() => trackAnalyticsEvent("finance_tools_click")}
        >
          <Calculator size={17} />
          <span>ابزار مالی</span>
        </Link>
      </div>
      <SiteUtilities />
      <CallMenu className="floating-call-menu" buttonClassName="floating-call" label="تماس" />
      <Toaster
        dir="rtl"
        position="top-center"
        theme="light"
        offset={88}
        visibleToasts={2}
        toastOptions={{ className: "hirmand-toast", duration: 2400 }}
      />
    </>
  );
}
