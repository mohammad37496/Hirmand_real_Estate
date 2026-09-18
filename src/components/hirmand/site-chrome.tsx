import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { CallMenu } from "./call-menu";
import { Footer } from "./footer";
import { Header } from "./header";
import { scrollToId } from "./scroll";

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
      <main className={cn("page", className)}>{children}</main>
      <Footer />
      <CallMenu className="floating-call-menu" buttonClassName="floating-call" label="تماس" />
      <Toaster
        dir="rtl"
        position="top-center"
        theme="dark"
        offset={88}
        visibleToasts={2}
        toastOptions={{ className: "hirmand-toast", duration: 2400 }}
      />
    </>
  );
}
