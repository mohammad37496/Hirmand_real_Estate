import { Link, useRouterState } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { BrandLogo } from "./logo";
import { scrollToId } from "./scroll";

export function Footer() {
  const onHome = useRouterState({ select: (s) => s.location.pathname === "/" });

  return (
    <footer className="footer">
      <BrandLogo size="footer" />
      <h3>{SITE.nameFa}</h3>
      <p className="footer-managed">{SITE.managedBy}</p>
      <p>{SITE.tagline}</p>
      <div className="footer-links">
        <Link
          to="/"
          hash="contact"
          onClick={(event) => {
            if (onHome) scrollToId(event, "contact");
          }}
        >
          تماس
        </Link>
        <Link
          to="/"
          hash="services"
          onClick={(event) => {
            if (onHome) scrollToId(event, "services");
          }}
        >
          خدمات
        </Link>
        <Link
          to="/"
          hash="tools"
          onClick={(event) => {
            if (onHome) scrollToId(event, "tools");
          }}
        >
          ابزار مالی
        </Link>
        <Link to="/tracking">کد رهگیری</Link>
        <Link
          to="/"
          hash="inquiry"
          onClick={(event) => {
            if (onHome) scrollToId(event, "inquiry");
          }}
        >
          درخواست
        </Link>
        <Link
          to="/"
          hash="location"
          onClick={(event) => {
            if (onHome) scrollToId(event, "location");
          }}
        >
          موقعیت
        </Link>
      </div>
      <small>© {SITE.nameFa} — تمامی حقوق محفوظ است</small>
    </footer>
  );
}
