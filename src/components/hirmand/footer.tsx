import { Link, useRouterState } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { BrandLogo } from "./logo";
import { scrollToId } from "./scroll";
import { EitaaIcon, InstagramIcon, TelegramIcon, WhatsAppIcon } from "./social-icons";

export function Footer() {
  const onHome = useRouterState({ select: (s) => s.location.pathname === "/" });
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <BrandLogo size="footer" />
      <h3>{SITE.nameFa}</h3>
      <p className="footer-managed">{SITE.managedBy}</p>
      <p>{SITE.tagline}</p>
      <p className="footer-address">{SITE.address}</p>

      <div className="footer-social" aria-label="شبکه‌های اجتماعی">
        <a
          className="social-link"
          href={SITE.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="اینستاگرام هیرمند"
        >
          <InstagramIcon />
        </a>
        <a
          className="social-link"
          href={SITE.telegram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تلگرام هیرمند"
        >
          <TelegramIcon />
        </a>
        <a
          className="social-link"
          href={SITE.eitaa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="ایتا هیرمند"
        >
          <EitaaIcon />
        </a>
        <a
          className="social-link"
          href={SITE.whatsappDirect}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="واتساپ هیرمند"
        >
          <WhatsAppIcon />
        </a>
      </div>

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
      <Link to="/" hash="inquiry" className="footer-cta">
        درخواست مشاوره و فایل ملک
      </Link>
      <small>
        © {year} {SITE.nameFa} — تمامی حقوق محفوظ است
      </small>
    </footer>
  );
}
