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
import {
  FAQS,
  mapLinks,
  NEIGHBORHOOD_GROUPS,
  NEIGHBORHOODS,
  OFFICE_MAP,
  personChat,
  PRINCIPLES,
  PROPERTY_TYPES,
  SERVICES,
  SITE,
  STEPS,
  TEAM,
  type Neighborhood,
} from "@/lib/site";
import { CallMenu, MapMenu } from "./call-menu";
import { FinanceTools } from "./finance-tools";
import { InquiryForm, type InquiryDraft } from "./inquiry-form";
import { BrandLogo } from "./logo";
import { MapAppButtons, MapEmbed } from "./map-apps";
import { PropertyShowcase } from "./property-showcase";
import { Reveal } from "./reveal";
import { scrollToId } from "./scroll";
import { SiteChrome } from "./site-chrome";
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

async function copyText(value: string) {
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
  } catch {
    toast.error("کپی انجام نشد");
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
        await copyText(value);
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

// RESTORED - full component continues in next update if truncated
export function SitePage({ initialProperties = [] }: { initialProperties?: import("@/lib/properties").Property[] }) {
  return (
    <SiteChrome>
      <p style={{ padding: 40, textAlign: "center" }}>در حال بازگردانی صفحه… لطفاً چند لحظه صبر کنید.</p>
    </SiteChrome>
  );
}
