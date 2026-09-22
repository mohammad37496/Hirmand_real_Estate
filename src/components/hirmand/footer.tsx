import { Link, useRouterState } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { BrandLogo } from "./logo";
import { scrollToId } from "./scroll";
import { EitaaIcon, InstagramIcon, TelegramIcon, WhatsAppIcon } from "./social-icons";

export function Footer() {
  const onHome = useRouterState({ select: (s) => s.location.pathname === "/" });
  const year = new Date().getFullYear();

  const socials = [
    { href: SITE.instagram, label: "اینستاگرام هیرمند", Icon: InstagramIcon },
    { href: SITE.telegram, label: "تلگرام هیرمند", Icon: TelegramIcon },
    { href: SITE.eitaa, label: "ایتا هیرمند", Icon: EitaaIcon },
    { href: SITE.whatsappDirect, label: "واتساپ هیرمند", Icon: WhatsAppIcon },
  ] as const;

  return (
    <footer className="footer">
      <BrandLogo size="footer" />
      <h3>{SITE.nameFa}</h3>
      <p className="footer-managed">{SITE.managedBy}</p>
      <p>{SITE.tagline}</p>
      <p className="footer-address">{SITE.address}</p>

      <div className="chip-row" style={{ justifyContent: "center", margin: "18px 0 8px" }} aria-label="شبکه‌های اجتماعی">
        {socials.map(({ href, label, Icon }) => (
          <a
            key={label}
            className="footer-social-chip"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
          >
            <Icon size={22} />
          </a>
        ))}
      </div>

      <div className="footer-links">
        <Link to="/properties">همه فایل‌ها</Link>
        <Link to="/" hash="about" onClick={(event) => { if (onHome) scrollToId(event, "about"); }}>درباره ما</Link>
        <Link to="/" hash="services" onClick={(event) => { if (onHome) scrollToId(event, "services"); }}>خدمات</Link>
        <Link to="/" hash="tools" onClick={(event) => { if (onHome) scrollToId(event, "tools"); }}>ابزار مالی</Link>
        <Link to="/tracking">باشگاه همکاران</Link>
        <Link to="/" hash="inquiry" onClick={(event) => { if (onHome) scrollToId(event, "inquiry"); }}>درخواست ملک</Link>
        <Link to="/favorites">نشان‌شده‌ها</Link>
        <Link to="/" hash="contact" onClick={(event) => { if (onHome) scrollToId(event, "contact"); }}>تماس</Link>
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
