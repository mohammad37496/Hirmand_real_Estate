import { SITE, TEAM } from "@/lib/site";
import type { Property } from "@/lib/properties";
import { propertyPath } from "@/lib/property-path";

const TX_LABEL: Record<string, string> = {
  buy: "خرید",
  sell: "فروش",
  rent: "اجاره",
  mortgage: "رهن",
};

const TYPE_LABEL: Record<string, string> = {
  apartment: "آپارتمان",
  villa: "ویلا و باغ",
  office: "اداری",
  heritage: "خانه اصیل",
  land: "زمین",
  commercial: "تجاری",
};

export function absoluteUrl(path = "/"): string {
  const base = SITE.url.replace(/\/$/, "");
  if (!path || path === "/") return base + "/";
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function ogImageUrl(path = "/images/isfahan-hero.jpg"): string {
  return absoluteUrl(path);
}

export function socialMeta(input: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
}) {
  const image = input.image ?? ogImageUrl();
  return [
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: "fa_IR" },
    { property: "og:site_name", content: SITE.nameFa },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: input.url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: input.title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
  ] as const;
}

export function homeHead() {
  const title = SITE.title;
  const description = SITE.description;
  const url = absoluteUrl("/");
  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "keywords",
        content:
          "املاک اصفهان, مشاور املاک اصفهان, خرید خانه اصفهان, فروش آپارتمان اصفهان, رهن و اجاره اصفهان, املاک هیرمند, گروه مشاورین املاک هیرمند, املاک سیمین, مرداویج, جلفا, سپاهان شهر",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow" },
      { name: "author", content: SITE.nameFa },
      { name: "geo.region", content: "IR-04" },
      { name: "geo.placename", content: "Isfahan" },
      { name: "geo.position", content: `${SITE.lat};${SITE.lng}` },
      { name: "ICBM", content: `${SITE.lat}, ${SITE.lng}` },
      { name: "language", content: "fa" },
      ...(typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: import.meta.env.VITE_GOOGLE_SITE_VERIFICATION }]
        : []),
      ...socialMeta({ title, description, url }),
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", hrefLang: "fa-IR", href: url },
      { rel: "alternate", hrefLang: "x-default", href: url },
    ],
  };
}

export function propertyPageTitle(property: Property): string {
  const tx = TX_LABEL[property.transactionType] ?? "";
  const type = TYPE_LABEL[property.propertyType] ?? "";
  return `${property.title} | ${tx} ${type} در ${property.neighborhood} | ${SITE.shortName}`;
}

export function propertyPageDescription(property: Property): string {
  const tx = TX_LABEL[property.transactionType] ?? "معامله";
  const type = TYPE_LABEL[property.propertyType] ?? "ملک";
  const area = property.areaM2 ? `، ${property.areaM2} متر` : "";
  const beds = property.bedrooms ? `، ${property.bedrooms} خواب` : "";
  const base = `${tx} ${type} در ${property.neighborhood}، اصفهان${area}${beds}. ${property.description}`
    .replace(/\s+/g, " ")
    .trim();
  return base.length > 160 ? base.slice(0, 157) + "…" : base;
}

export function propertyHead(property: Property | null, slug: string) {
  if (!property) {
    const title = `فایل یافت نشد | ${SITE.nameFa}`;
    return {
      meta: [
        { title },
        { name: "description", content: "این فایل دیگر در دسترس نیست." },
        { name: "robots", content: "noindex, follow" },
      ],
      links: [{ rel: "canonical", href: absoluteUrl(`/properties/${slug}`) }],
    };
  }

  const title = propertyPageTitle(property);
  const description = propertyPageDescription(property);
  const url = absoluteUrl(propertyPath(property));
  const image =
    property.images[0] && property.images[0].startsWith("http")
      ? property.images[0]
      : property.images[0]
        ? absoluteUrl(property.images[0])
        : ogImageUrl();

  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "keywords",
        content: `${property.title}, ${TYPE_LABEL[property.propertyType] ?? ""} ${property.neighborhood}, املاک ${property.neighborhood}, ${TX_LABEL[property.transactionType] ?? ""} اصفهان, املاک هیرمند`,
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "geo.region", content: "IR-04" },
      { name: "geo.placename", content: property.neighborhood },
      ...socialMeta({ title, description, url, image, type: "article" }),
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", hrefLang: "fa-IR", href: url },
    ],
  };
}

export function trackingHead() {
  const title = `ثبت قرارداد و کد رهگیری | ${SITE.nameFa}`;
  const description =
    "سامانه باشگاه همکاران هیرمند؛ ورود امن املاک، ثبت قرارداد، دریافت کد رهگیری و مشاهده وضعیت مهرها و پاداش ثبت رایگان.";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, follow" },
      ...socialMeta({ title, description, url: absoluteUrl("/tracking") }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/tracking") }],
  };
}

export function propertyJsonLd(property: Property) {
  const url = absoluteUrl(propertyPath(property));
  const image = property.images.map((src) =>
    src.startsWith("http") ? src : absoluteUrl(src),
  );
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    priceCurrency: "IRR",
    url,
    seller: {
      "@type": "RealEstateAgent",
      name: SITE.nameFa,
      telephone: property.contactPhone.replace(/^0/, "+98"),
    },
  };

  if (property.price) {
    const tomanPrice = Number(property.price);
    offers.price =
      Number.isFinite(tomanPrice) && tomanPrice > 0
        ? String(Math.round(tomanPrice * 10))
        : property.price;
  }

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    name: property.title,
    description: property.description,
    url,
    datePosted: property.publishedAt ?? property.createdAt,
    image: image.length ? image : [ogImageUrl()],
    address: {
      "@type": "PostalAddress",
      addressLocality: property.city || SITE.locality,
      addressRegion: "اصفهان",
      addressCountry: "IR",
      streetAddress: property.address || property.neighborhood,
    },
    ...(property.areaM2
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: property.areaM2,
            unitCode: "MTK",
          },
        }
      : {}),
    ...(property.bedrooms != null ? { numberOfRooms: property.bedrooms } : {}),
    offers,
    provider: {
      "@id": `${SITE.url}#organization`,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function enhancedOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["RealEstateAgent", "LocalBusiness"],
        "@id": `${SITE.url}#organization`,
        name: SITE.nameFa,
        alternateName: ["Hirmand Real Estate", "Hirmand Real Estate Consultants", "املاک هیرمند"],
        url: SITE.url,
        logo: absoluteUrl("/images/hirmand-logo.png"),
        image: [absoluteUrl("/images/hirmand-logo.png"), ogImageUrl()],
        founder: { "@type": "Person", name: "آقای شیخ" },
        telephone: ["+989131056029", "+989183576883", "+983137850615"],
        description: SITE.description,
        slogan: `${SITE.sloganStrong} ${SITE.sloganRest}`,
        address: {
          "@type": "PostalAddress",
          streetAddress: "سه راه سیمین، خیابان جانبازان، بلوار شهید بخشی",
          addressLocality: SITE.locality,
          addressRegion: "اصفهان",
          addressCountry: "IR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: SITE.lat,
          longitude: SITE.lng,
        },
        hasMap: SITE.mapUrl,
        areaServed: [
          { "@type": "City", name: "اصفهان" },
          { "@type": "AdministrativeArea", name: "استان اصفهان" },
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: "+989131056029",
            contactType: "customer service",
            availableLanguage: ["Persian", "fa"],
            areaServed: "IR",
          },
          {
            "@type": "ContactPoint",
            telephone: "+983137850615",
            contactType: "customer service",
            availableLanguage: ["fa"],
          },
        ],
        employee: TEAM.map((person) => ({
          "@type": "Person",
          name: person.name,
          jobTitle: person.role,
          telephone: `+98${person.phone.slice(1)}`,
        })),
        sameAs: [SITE.instagram, SITE.telegram, SITE.eitaa, SITE.whatsappDirect].filter(Boolean),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}#website`,
        url: SITE.url,
        name: SITE.nameFa,
        description: SITE.description,
        inLanguage: "fa-IR",
        publisher: { "@id": `${SITE.url}#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE.url}/properties?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export { TX_LABEL, TYPE_LABEL };
