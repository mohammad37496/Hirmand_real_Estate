import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  Compass,
  Copy,
  FileKey,
  Handshake,
  Home,
  KeyRound,
  Landmark,
  MapPinned,
  Phone,
  Scale,
  Search,
  Trees,
} from "lucide-react";
import { toast } from "sonner";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  FAQS,
  mapLinks,
  NEIGHBORHOOD_GROUPS,
  NEIGHBORHOODS,
  personChat,
  PRINCIPLES,
  PROPERTY_TYPES,
  SERVICES,
  SITE,
  STEPS,
  TEAM,
  type Neighborhood,
} from "@/lib/site";
import { CallMenu } from "./call-menu";
import { FinanceTools } from "./finance-tools";
import { InquiryForm, type InquiryDraft } from "./inquiry-form";
import { BrandLogo } from "./logo";
import { MapAppButtons, MapEmbed } from "./map-apps";
import { PropertyShowcase } from "./property-showcase";
import { BudgetMatcher } from "./budget-matcher";
import type { PropertyCardData } from "@/lib/properties";
import { Reveal } from "./reveal";
import { scrollToId } from "./scroll";
import { SiteChrome } from "./site-chrome";
import { SmartRecommendations } from "./smart-recommendations";
import { EitaaIcon, InstagramIcon, TelegramIcon, WhatsAppIcon } from "./social-icons";

const PRINCIPLE_ICONS = {
  honesty: Scale,
  experience: Compass,
  advice: BadgeCheck,
} as const;

const SERVICE_ICONS = {
  buy: Home,
  sell: KeyRound,
  mortgage: Landmark,
  rent: Building2,
} as const;

const TYPE_ICONS = {
  apartment: Building2,
  villa: Trees,
  office: Landmark,
  heritage: Home,
} as const;

const TEAM_ICONS = {
  briefcase: Briefcase,
  handshake: Handshake,
} as const;

const OFFICE_PLACE: Neighborhood = {
  name: "دفتر هیرمند — سه راه سیمین",
  lat: SITE.lat,
  lng: SITE.lng,
};

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast.success("شماره کپی شد");
    return true;
  } catch {
    toast.error("کپی انجام نشد");
    return false;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={label}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const copied = await copyText(value);
        if (!copied) return;
        setDone(true);
        window.setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function SectionHead({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="section-head">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function Hero() {
  const [deal, setDeal] = useState("خرید");
  const [propertyType, setPropertyType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  function searchProperties() {
    const transaction = SERVICES.find((item) => item.title === deal)?.id;
    const type = PROPERTY_TYPES.find((item) => item.title === propertyType)?.id;
    const params = new URLSearchParams();
    if (transaction) params.set("transaction", transaction);
    if (type) params.set("type", type);
    if (neighborhood) params.set("neighborhood", neighborhood);
    trackAnalyticsEvent("property_search");
    window.location.assign(`/properties${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    searchProperties();
  }

  return (
    <section className="hero" id="top">
      <div className="hero-media" aria-hidden="true">
        <img
          className="hero-image"
          src="/images/isfahan-hero.jpg"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
        <div className="hero-veil" />
      </div>
      <div className="hero-inner">
        <BrandLogo size="hero" />
        <p className="hero-kicker">{SITE.kicker}</p>
        <h1>{SITE.nameFa}</h1>
        <p className="english-name">{SITE.nameEn}</p>
        <p className="hero-managed">{SITE.managedBy}</p>
        <p className="slogan">
          <strong>{SITE.sloganStrong}</strong>
          <span>{SITE.sloganRest}</span>
        </p>
        <form className="hero-search" onSubmit={submit}>
          <label className="sr-only" htmlFor="hero-deal">
            نوع معامله
          </label>
          <select id="hero-deal" value={deal} onChange={(event) => setDeal(event.target.value)}>
            {SERVICES.map((item) => (
              <option key={item.id} value={item.title}>
                {item.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="hero-type">
            نوع ملک
          </label>
          <select
            id="hero-type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
          >
            <option value="">نوع ملک</option>
            {PROPERTY_TYPES.map((item) => (
              <option key={item.id} value={item.title}>
                {item.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="hero-area">
            محله
          </label>
          <select
            id="hero-area"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
          >
            <option value="">محله در اصفهان</option>
            {NEIGHBORHOODS.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-gold search-submit">
            <Search size={16} />
            جستجوی فایل
          </button>
        </form>
        {/* One primary action, one secondary, one contact affordance.
            The map shortcuts and the "services" anchor both duplicated
            links that already live in the header and in the sections below,
            so they were removed to give the first screen a clear hierarchy. */}
        <div className="hero-actions">
          <Link to="/properties" className="btn-gold">
            مشاهده فایل‌ها
          </Link>
          <Link to="/" hash="inquiry" className="btn-ghost" onClick={(event) => scrollToId(event, "inquiry")}>
            درخواست اختصاصی
          </Link>
          <CallMenu label="تماس با مشاور" />
        </div>
        <div className="hero-intents" aria-label="شروع سریع جست‌وجو">
          <button
            type="button"
            className="hero-intent"
            onClick={() => {
              setDeal("خرید");
              setPropertyType("آپارتمان");
              setNeighborhood("");
              window.location.assign("/properties?transaction=buy&type=apartment");
            }}
          >
            خرید آپارتمان
          </button>
          <button
            type="button"
            className="hero-intent"
            onClick={() => window.location.assign("/properties?transaction=mortgage&type=apartment")}
          >
            رهن آپارتمان
          </button>
          <button
            type="button"
            className="hero-intent"
            onClick={() => window.location.assign("/properties?transaction=rent&type=apartment")}
          >
            اجاره آپارتمان
          </button>
          <button
            type="button"
            className="hero-intent"
            onClick={() => window.location.assign("/properties?transaction=buy&type=villa")}
          >
            خرید ویلا و باغ
          </button>
        </div>
        <div className="hero-proof" aria-label="اطلاعات سریع هیرمند">
          <span><strong>{NEIGHBORHOODS.length}+</strong> محله اصفهان</span>
          <span><strong>{SERVICES.length}</strong> خدمت اصلی</span>
          <span><strong>{TEAM.length}</strong> مشاور مستقیم</span>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const highlights = [
    { value: `${NEIGHBORHOODS.length}+`, label: "محله روی نقشه" },
    { value: `${SERVICES.length}`, label: "مسیر اصلی معامله" },
    { value: `${TEAM.length}`, label: "مشاور مستقیم" },
    { value: "۳", label: "سرویس نقشه و مسیریابی" },
  ] as const;

  return (
    <section className="trust-strip-wrap" aria-label="اطلاعات کلیدی هیرمند">
      <div className="trust-strip">
        {highlights.map((item) => (
          <div key={item.label} className="trust-stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <Reveal as="section" className="section about-section" id="about">
      <div className="about-grid">
        <div className="about-copy">
          <SectionHead kicker="چرا هیرمند" title="انتخاب آگاهانه، معامله شفاف" />
          <p className="lede">
            گروه مشاورین املاک هیرمند {SITE.managedBy}، در مسیر خرید، فروش، رهن یا اجاره اطلاعات روشن و
            پیگیری دقیق را در اختیار شما می‌گذارد تا تصمیم‌گیری ساده‌تر شود.
          </p>
          <div className="principle-grid">
            {PRINCIPLES.map((item) => {
              const Icon = PRINCIPLE_ICONS[item.id];
              return (
                <article key={item.id} className="principle-card">
                  <div className="icon-box">
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
        <figure className="about-photo">
          <img
            src="/images/isfahan-arch.jpg"
            alt="نمایی از معماری اصفهان در شب"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>
    </Reveal>
  );
}

function TeamMessenger({ personId }: { personId: (typeof TEAM)[number]["id"] }) {
  const person = TEAM.find((item) => item.id === personId) ?? TEAM[0];
  const chat = personChat(person);
  const items = [
    { href: chat.whatsapp, label: "واتساپ", icon: <WhatsAppIcon size={18} />, external: true },
    { href: chat.telegram, label: "تلگرام", icon: <TelegramIcon size={18} />, external: false },
    { href: chat.eitaa, label: "ایتا", icon: <EitaaIcon size={18} />, external: true },
    { href: chat.instagram, label: "اینستاگرام", icon: <InstagramIcon size={18} />, external: true },
  ];

  return (
    <div className="team-socials" role="group" aria-label={`شبکه‌های اجتماعی ${person.name}`}>
      {items.map((item) => (
        <a
          key={item.label}
          className="team-social"
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
          aria-label={`ارسال پیام به ${person.name} در ${item.label}`}
          title={item.label}
        >
          {item.icon}
        </a>
      ))}
    </div>
  );
}

function Team() {
  return (
    <Reveal as="section" className="section" id="team">
      <SectionHead
        kicker="مشاورین"
        title="تیم هیرمند"
        text={`${SITE.managedBy}؛ برای خرید، فروش، رهن و اجاره مستقیم در دسترس هستید.`}
      />
      <div className="team-grid">
        {TEAM.map((person) => {
          const Icon = TEAM_ICONS[person.icon];
          return (
            <article key={person.id} className="team-card">
              <div className="team-avatar" aria-hidden="true">
                <Icon size={26} strokeWidth={1.7} />
              </div>
              <div className="team-copy">
                <p className="team-role">{person.role}</p>
                <h3>{person.name}</h3>
                <p className="team-phone" dir="ltr">
                  {person.phoneDisplay}
                </p>
              </div>
              <div className="team-actions">
                <a className="btn-gold" href={`tel:${person.phone}`}>
                  <Phone size={16} />
                  تماس
                </a>
                <CopyButton value={person.phone} label={`کپی شماره ${person.name}`} />
              </div>
              <Link className="team-profile-link" to="/consultants/$id" params={{ id: person.id }}>
                پروفایل مشاور ↗
              </Link>
              <TeamMessenger personId={person.id} />
            </article>
          );
        })}
      </div>
    </Reveal>
  );
}

function Services({ onPick }: { onPick: (title: string) => void }) {
  return (
    <Reveal as="section" className="section" id="services">
      <SectionHead
        kicker="خدمات"
        title="خرید، فروش، رهن و اجاره"
        text="چهار مسیر اصلی معامله؛ با توضیح روشن و همراهی تا پایان کار."
      />
      <div className="service-grid">
        {SERVICES.map((item, index) => {
          const Icon = SERVICE_ICONS[item.id];
          return (
            <Reveal key={item.id} className="service-card" delay={index * 70}>
              <button
                type="button"
                className="service-card-button"
                onClick={() => onPick(item.title)}
                aria-label={`درخواست ${item.title}`}
              >
                <span className="icon-box">
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span className="service-card-copy">
                  <span className="service-card-title">{item.title}</span>
                  <span className="service-card-text">{item.text}</span>
                </span>
                <span className="service-card-arrow" aria-hidden="true">↗</span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </Reveal>
  );
}

function Properties({ onPick }: { onPick: (title: string) => void }) {
  return (
    <Reveal as="section" className="section" id="properties">
      <SectionHead
        kicker="انواع ملک"
        title="برای هر سبک زندگی"
        text="فایل مناسب پس از شناخت نیاز شما معرفی می‌شود. این‌ها مسیرهایی است که بیشتر روی آن کار می‌کنیم."
      />
      <div className="type-grid">
        {PROPERTY_TYPES.map((item, index) => {
          const Icon = TYPE_ICONS[item.id];
          return (
            <Reveal key={item.id} className="type-card" delay={index * 60}>
              <button type="button" onClick={() => onPick(item.title)} aria-label={`درخواست ${item.title}`}>
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="type-body">
                  <span className="icon-box sm">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </Reveal>
  );
}

function Process() {
  return (
    <Reveal as="section" className="section">
      <SectionHead kicker="مسیر همکاری" title="از تماس تا معامله، چهار قدم مشخص" />
      <ol className="step-grid">
        {STEPS.map((item, index) => (
          <li key={item.id} className="step-card">
            <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

function Tools() {
  return (
    <Reveal as="section" className="section" id="tools">
      <SectionHead
        kicker="ابزار مالی"
        title="تبدیل رهن به اجاره، کمیسیون و وام"
        text="نوار لغزنده رهن و اجاره را به چپ و راست بکشید. مبالغ به تومان است و اعداد جنبه راهنما دارند."
      />
      <FinanceTools />
    </Reveal>
  );
}

function TrackingCta() {
  return (
    <Reveal as="section" className="section" id="tracking-cta">
      <Link to="/tracking" className="tracking-card">
        <div className="tracking-card-copy">
          <span className="kicker">باشگاه همکاران هیرمند</span>
          <h2>ثبت قرارداد، دریافت کد رهگیری و پاداش همکاری</h2>
          <p>
            املاک همکار می‌تواند قرارداد را آنلاین ثبت کند، وضعیت تأیید را ببیند و هر ۳ قرارداد تأییدشده
            یک اعتبار ثبت رایگان دریافت کند. برای هر دفتر، کارت ۱۲ مهر و QR اختصاصی هم داریم.
          </p>
          <span className="btn-gold tracking-cta">ورود به سامانه همکاری</span>
        </div>
        <div className="tracking-card-icon" aria-hidden="true">
          <FileKey size={42} strokeWidth={1.5} />
        </div>
      </Link>
    </Reveal>
  );
}

function Neighborhoods({ onPick }: { onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Neighborhood>(OFFICE_PLACE);

  const groups = useMemo(() => {
    const q = query.trim();
    if (!q) return NEIGHBORHOOD_GROUPS;
    return NEIGHBORHOOD_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.name.includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const target = { lat: selected.lat, lng: selected.lng, label: selected.name };
  const links = mapLinks(target);

  return (
    <Reveal as="section" className="section" id="areas">
      <SectionHead
        kicker="اصفهان"
        title="محله‌هایی که در آن‌ها فعالیم"
        text={`بیش از ${NEIGHBORHOODS.length} محله اصفهان. روی نام محله بزنید تا روی نقشه گوگل دیده شود؛ مسیر را می‌توانید در بلد یا نشان هم باز کنید.`}
      />
      <div className="area-layout">
        <div className="area-groups">
          <label className="field area-search">
            <span className="field-label">جستجوی محله</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="مثلاً مرداویج، جلفا، خوراسگان"
            />
          </label>
          {groups.length === 0 ? (
            <p className="commission-hint">محله‌ای با این نام پیدا نشد.</p>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="area-group">
                <h3>{group.title}</h3>
                <div className="chip-row">
                  {group.items.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      className={selected.name === item.name ? "chip is-active" : "chip"}
                      onClick={() => setSelected(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <aside className="area-map">
          <div className="area-map-head">
            <div className="icon-box">
              <MapPinned size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h3>{selected.name}</h3>
              <p>اصفهان — نمایش روی نقشه</p>
            </div>
          </div>
          <MapEmbed target={target} title={`نقشه ${selected.name}`} />
          <MapAppButtons target={target} googleHref={links.google} />
          {selected.name !== OFFICE_PLACE.name ? (
            <button type="button" className="btn-gold area-request" onClick={() => onPick(selected.name)}>
              درخواست ملک در {selected.name}
            </button>
          ) : (
            <a className="btn-ghost area-request" href="#location" onClick={(event) => scrollToId(event, "location")}>
              جزئیات دفتر هیرمند
            </a>
          )}
        </aside>
      </div>
    </Reveal>
  );
}

function Inquiry({ draft }: { draft: InquiryDraft }) {
  return (
    <Reveal as="section" className="section inquiry-section" id="inquiry">
      <div className="inquiry-layout">
        <div>
          <SectionHead
            kicker="درخواست ملک"
            title="نیازتان را بنویسید؛ ادامه را با هم پیش می‌بریم"
            text="درخواست شما در سامانه هیرمند ثبت می‌شود و می‌توانید برای پیگیری، مستقیماً با مشاور منتخب در واتساپ یا تماس تلفنی در ارتباط باشید."
          />
        </div>
        <InquiryForm draft={draft} />
      </div>
    </Reveal>
  );
}

function Contact() {
  const socials = [
    { href: SITE.instagram, icon: <InstagramIcon />, title: "اینستاگرام", text: "صفحه رسمی" },
    { href: SITE.telegram, icon: <TelegramIcon />, title: "تلگرام", text: "کانال هیرمند" },
    { href: SITE.eitaa, icon: <EitaaIcon />, title: "ایتا", text: "کانال هیرمند" },
    { href: SITE.whatsapp, icon: <WhatsAppIcon />, title: "واتساپ", text: "گروه اطلاع‌رسانی" },
  ];

  return (
    <Reveal as="section" className="section" id="contact">
      <SectionHead kicker="ارتباط" title="تماس مستقیم با مشاورین هیرمند" />
      <div className="contact-grid contact-grid-people">
        {TEAM.map((person) => (
          <div key={person.id} className="contact-wrap">
            <a className="contact-card" href={`tel:${person.phone}`}>
              <div className="icon-box">
                <Phone size={22} strokeWidth={1.8} />
              </div>
              <span>
                <small>
                  {person.role} — {person.name}
                </small>
                <strong dir="ltr">{person.phoneDisplay}</strong>
              </span>
            </a>
            <CopyButton value={person.phone} label={`کپی شماره ${person.name}`} />
          </div>
        ))}
        <div className="contact-wrap">
          <a className="contact-card" href={`tel:${SITE.phone.office}`}>
            <div className="icon-box">
              <Building2 size={22} strokeWidth={1.8} />
            </div>
            <span>
              <small>تلفن دفتر</small>
              <strong dir="ltr">{SITE.phone.officeDisplay}</strong>
            </span>
          </a>
          <CopyButton value={SITE.phone.office} label="کپی تلفن دفتر" />
        </div>
      </div>
      <div className="social-row" aria-label="شبکه‌های اجتماعی هیرمند">
        {socials.map((social) => (
          <a
            key={social.title}
            className="social-link"
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${social.title} — ${social.text}`}
            title={`${social.title} — ${social.text}`}
          >
            <span className="social-badge">{social.icon}</span>
          </a>
        ))}
      </div>
    </Reveal>
  );
}

function FAQ() {
  return (
    <Reveal as="section" className="section">
      <SectionHead kicker="راهنما" title="پرسش‌های متداول" />
      <div className="faq-list">
        {FAQS.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>
              {item.q}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </Reveal>
  );
}

function Location() {
  const office = { lat: SITE.lat, lng: SITE.lng, label: "دفتر هیرمند" };
  return (
    <Reveal as="section" className="section" id="location">
      <SectionHead kicker="دفتر" title="موقعیت گروه مشاورین املاک هیرمند" />
      <div className="location-card">
        <MapEmbed target={office} title="موقعیت دفتر هیرمند روی نقشه" />
        <div className="location-body">
          <div className="location-top">
            <div className="icon-box">
              <MapPinned size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h3>دفتر هیرمند</h3>
              <p>{SITE.address}</p>
              <p className="hours">{SITE.hours}</p>
              <p className="hours">{SITE.managedBy}</p>
            </div>
          </div>
          <MapAppButtons target={office} googleHref={SITE.mapUrl} />
        </div>
      </div>
    </Reveal>
  );
}

export function SitePage({ initialProperties = [] }: { initialProperties?: PropertyCardData[] }) {
  const [draft, setDraft] = useState<InquiryDraft>({
    deal: "خرید",
    propertyType: "",
    neighborhood: "",
  });

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  function goInquiry(next: Partial<InquiryDraft>, event?: MouseEvent<HTMLAnchorElement>) {
    setDraft((prev) => ({ ...prev, ...next }));
    if (event) scrollToId(event, "inquiry");
    else document.getElementById("inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <SiteChrome>
      {/* Order matters: people arrive looking for properties, so the live
          listings come straight after the hero, and the softer brand material
          (about, team, partner club) sits below the decision content. */}
      <main className="site-home">
        <Hero />
        <TrustStrip />
        <PropertyShowcase initialProperties={initialProperties} />
        <SmartRecommendations />
        <Services onPick={(title) => goInquiry({ deal: title })} />
        <Properties onPick={(title) => goInquiry({ propertyType: title })} />
        <BudgetMatcher />
        <About />
        <Process />
        <Neighborhoods onPick={(name) => goInquiry({ neighborhood: name })} />
        <Tools />
        <Team />
        <TrackingCta />
        <Inquiry draft={draft} />
        <FAQ />
        <Contact />
        <Location />
      </main>
    </SiteChrome>
  );
}
