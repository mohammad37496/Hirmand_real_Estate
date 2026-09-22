export const SITE = {
  nameFa: "گروه مشاورین املاک هیرمند",
  shortName: "هیرمند",
  nameEn: "HIRMAND REAL ESTATE CONSULTANTS",
  title: "املاک هیرمند | خرید، فروش، رهن و اجاره ملک در اصفهان",
  url: (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) || "https://www.hirmandrealestate.ir",
  description:
    "گروه مشاورین املاک هیرمند در اصفهان؛ خرید، فروش، رهن و اجاره آپارتمان، ویلا، زمین، اداری و تجاری با مشاوره تخصصی و همراهی از انتخاب تا قرارداد.",
  sloganStrong: "خانه، فقط یک مکان نیست",
  sloganRest: "آغاز یک زندگی بهتر است",
  tagline: "همراه شما برای انتخاب خانه‌ای بهتر",
  kicker: "دفتر تخصصی املاک در اصفهان",
  managedBy: "با مدیریت آقای شیخ",
  hours: "پاسخگویی با هماهنگی قبلی",
  phone: {
    mobile: "09131056029",
    mobileDisplay: "0913 105 6029",
    office: "03137850615",
    officeDisplay: "031 3785 0615",
  },
  address: "اصفهان، سه راه سیمین، خیابان جانبازان، بلوار شهید بخشی",
  locality: "اصفهان",
  lat: 32.610108,
  lng: 51.622979,
  mapUrl: "https://maps.app.goo.gl/F3pAnDsiDYzggoDR8",
  instagram: "https://www.instagram.com/hirmand.realestate/",
  instagramDm: "https://ig.me/m/hirmand.realestate",
  telegram: "https://t.me/Hirmand_realestate",
  eitaa: "https://eitaa.com/Hirmand_realestate",
  whatsapp: "https://chat.whatsapp.com/KpwHPsdYBwU7fBMsPQGUpK",
  whatsappDirect: "https://wa.me/989131056029",
} as const;

export type TeamId = "sheikh" | "moradi";

export const TEAM = [
  {
    id: "sheikh" as const,
    name: "آقای شیخ",
    role: "مدیر",
    icon: "briefcase" as const,
    phone: "09131056029",
    phoneDisplay: "0913 105 6029",
    wa: "https://wa.me/989131056029",
  },
  {
    id: "moradi" as const,
    name: "آقای مرادی",
    role: "مشاور ارشد",
    icon: "handshake" as const,
    phone: "09183576883",
    phoneDisplay: "0918 357 6883",
    wa: "https://wa.me/989183576883",
  },
] as const;

export type TeamMember = (typeof TEAM)[number];

export function intlPhone(phone: string) {
  return phone.replace(/^0/, "98");
}

export function personChat(person: TeamMember, extra = "") {
  const intl = intlPhone(person.phone);
  const text = encodeURIComponent(
    [`سلام ${person.name}، از وب‌سایت ${SITE.nameFa} پیام می‌دهم.`, extra].filter(Boolean).join("\n"),
  );
  return {
    tel: `tel:${person.phone}`,
    whatsapp: `https://wa.me/${intl}?text=${text}`,
    telegram: `tg://resolve?phone=${intl}`,
    telegramWeb: SITE.telegram,
    eitaa: SITE.eitaa,
    instagram: SITE.instagramDm,
  };
}

export type MapTarget = {
  lat: number;
  lng: number;
  label: string;
};

export function mapLinks(target: MapTarget = { lat: SITE.lat, lng: SITE.lng, label: SITE.shortName }) {
  const q = encodeURIComponent(`${target.label} اصفهان`);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`,
    googlePlace: `https://www.google.com/maps/place/${target.lat},${target.lng}/@${target.lat},${target.lng},17z`,
    balad: `https://balad.ir/location?latitude=${target.lat}&longitude=${target.lng}`,
    neshan: `https://neshan.org/maps/@${target.lat},${target.lng},17z`,
    embed: `https://maps.google.com/maps?q=${target.lat},${target.lng}&z=16&hl=fa&output=embed`,
    osm: `https://www.openstreetmap.org/export/embed.html?bbox=${target.lng - 0.012},${target.lat - 0.008},${target.lng + 0.012},${target.lat + 0.008}&layer=mapnik&marker=${target.lat},${target.lng}`,
    search: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

export const OFFICE_MAP = mapLinks({
  lat: SITE.lat,
  lng: SITE.lng,
  label: "گروه مشاورین املاک هیرمند",
});

// Primary navigation stays deliberately short: every entry is a real
// destination, and the partner club / about pages live in the footer so the
// header never becomes a wall of links.
export const NAV = [
  { id: "listings", label: "فایل‌ها", to: "/properties", hash: "" },
  { id: "services", label: "خدمات", to: "/", hash: "services" },
  { id: "properties", label: "انواع ملک", to: "/", hash: "properties" },
  { id: "budget-match", label: "بودجه‌یاب", to: "/", hash: "budget-match" },
  { id: "areas", label: "محله‌ها", to: "/", hash: "areas" },
  { id: "tools", label: "ابزار مالی", to: "/", hash: "tools" },
  { id: "contact", label: "تماس", to: "/", hash: "contact" },
] as const;

export const SERVICES = [
  {
    id: "buy",
    title: "خرید",
    text: "از بازدید تا سند کنار شما هستیم تا خانه‌ای متناسب با زندگی‌تان پیدا کنید.",
  },
  {
    id: "sell",
    title: "فروش",
    text: "قیمت‌گذاری واقع‌بینانه و معرفی درست ملک، برای فروشی آرام و مطمئن.",
  },
  {
    id: "mortgage",
    title: "رهن",
    text: "گزینه‌هایی متناسب با بودجه، با شفافیت کامل در شرایط و قرارداد.",
  },
  {
    id: "rent",
    title: "اجاره",
    text: "انتخاب ملک مناسب و پیگیری قرارداد، بدون پیچیدگی و اتلاف وقت.",
  },
] as const;

export const PRINCIPLES = [
  {
    id: "honesty",
    title: "صداقت",
    text: "هر ملک را همان‌طور که هست معرفی می‌کنیم؛ شفاف، دقیق و قابل اعتماد.",
  },
  {
    id: "experience",
    title: "تجربه",
    text: "آشنایی با بازار اصفهان و محله‌ها، برای تصمیم‌هایی با اطمینان بیشتر.",
  },
  {
    id: "advice",
    title: "مشاوره تخصصی",
    text: "قبل از هر معامله، شرایط، قیمت و مدارک را با هم بررسی می‌کنیم.",
  },
] as const;

export const PROPERTY_TYPES = [
  {
    id: "apartment",
    title: "آپارتمان",
    text: "واحدهای مسکونی در محله‌های مختلف اصفهان، متناسب با بودجه و سبک زندگی.",
    image: "/images/type-apartment.jpg",
  },
  {
    id: "villa",
    title: "ویلا و باغ",
    text: "فضای باز، آرامش و خانه‌هایی برای زندگی خارج از هیاهوی شهر.",
    image: "/images/type-villa.jpg",
  },
  {
    id: "office",
    title: "اداری و تجاری",
    text: "دفتر، مغازه و موقعیت‌های کاری با نگاه واقع‌بینانه به بازده و دسترسی.",
    image: "/images/type-office.jpg",
  },
  {
    id: "heritage",
    title: "خانه اصیل",
    text: "خانه‌های حیاط‌دار و بافت بااصالت اصفهان، برای زندگی یا سرمایه‌گذاری.",
    image: "/images/type-heritage.jpg",
  },
] as const;

export type Neighborhood = {
  name: string;
  lat: number;
  lng: number;
};

export const NEIGHBORHOOD_GROUPS: { title: string; items: Neighborhood[] }[] = [
  {
    title: "مرکز و بافت تاریخی",
    items: [
      { name: "جلفا", lat: 32.6345, lng: 51.6578 },
      { name: "خواجو", lat: 32.6365, lng: 51.6848 },
      { name: "سی‌وسه‌پل", lat: 32.6442, lng: 51.6675 },
      { name: "چهارباغ عباسی", lat: 32.6518, lng: 51.67 },
      { name: "چهارباغ پایین", lat: 32.656, lng: 51.6725 },
      { name: "چهارباغ بالا", lat: 32.637, lng: 51.668 },
      { name: "عباس‌آباد", lat: 32.6485, lng: 51.654 },
      { name: "احمدآباد", lat: 32.6568, lng: 51.691 },
      { name: "حکیم نظامی", lat: 32.6415, lng: 51.6735 },
      { name: "تخت فولاد", lat: 32.6275, lng: 51.6875 },
      { name: "نقش جهان", lat: 32.6574, lng: 51.6776 },
      { name: "دردشت", lat: 32.6695, lng: 51.686 },
      { name: "طوقچی", lat: 32.6718, lng: 51.6925 },
      { name: "جوباره", lat: 32.6678, lng: 51.6845 },
      { name: "شهشهان", lat: 32.6645, lng: 51.681 },
      { name: "بیدآباد", lat: 32.6555, lng: 51.6495 },
      { name: "لنبان", lat: 32.6618, lng: 51.644 },
      { name: "علی‌قلی‌آقا", lat: 32.6588, lng: 51.6475 },
      { name: "حسن‌آباد", lat: 32.6525, lng: 51.6765 },
      { name: "آمادگاه", lat: 32.6538, lng: 51.6718 },
      { name: "فردوسی", lat: 32.6622, lng: 51.6888 },
      { name: "ابن‌سینا", lat: 32.6655, lng: 51.6935 },
      { name: "مهرآباد", lat: 32.6435, lng: 51.6885 },
      { name: "پاچنار", lat: 32.6395, lng: 51.6625 },
      { name: "شیخ صدوق", lat: 32.6248, lng: 51.6665 },
      { name: "میرزاطاهر", lat: 32.6388, lng: 51.651 },
      { name: "دروازه دولت", lat: 32.655, lng: 51.6645 },
      { name: "هاتف", lat: 32.653, lng: 51.6785 },
      { name: "چرخاب", lat: 32.6595, lng: 51.696 },
      { name: "شمس‌آباد", lat: 32.646, lng: 51.6965 },
    ],
  },
  {
    title: "جنوب اصفهان",
    items: [
      { name: "مرداویج", lat: 32.6215, lng: 51.6668 },
      { name: "هزارجریب", lat: 32.6118, lng: 51.6615 },
      { name: "سپاهان‌شهر", lat: 32.5795, lng: 51.681 },
      { name: "صفه", lat: 32.6035, lng: 51.6815 },
      { name: "کوهسار", lat: 32.5965, lng: 51.671 },
      { name: "استادان", lat: 32.6165, lng: 51.6548 },
      { name: "باغ غدیر", lat: 32.6012, lng: 51.654 },
      { name: "بهارستان", lat: 32.486, lng: 51.792 },
      { name: "ملاصدرا", lat: 32.6188, lng: 51.6585 },
      { name: "گل‌نرگس", lat: 32.6065, lng: 51.6495 },
      { name: "سعادت‌آباد", lat: 32.6135, lng: 51.641 },
      { name: "رزمندگان", lat: 32.5995, lng: 51.6395 },
      { name: "دشتی", lat: 32.6155, lng: 51.6715 },
      { name: "باغ زرشک", lat: 32.6305, lng: 51.6548 },
      { name: "سیچان", lat: 32.6348, lng: 51.6495 },
      { name: "مارنان", lat: 32.6405, lng: 51.6385 },
      { name: "کوی امام", lat: 32.5915, lng: 51.6755 },
      { name: "آتشگاه", lat: 32.652, lng: 51.5985 },
      { name: "کوی سپاهان", lat: 32.5855, lng: 51.6785 },
    ],
  },
  {
    title: "شمال و شرق",
    items: [
      { name: "خانه اصفهان", lat: 32.7185, lng: 51.6695 },
      { name: "کاوه", lat: 32.6985, lng: 51.6645 },
      { name: "مشتاق", lat: 32.6515, lng: 51.7015 },
      { name: "ملک‌شهر", lat: 32.7385, lng: 51.6415 },
      { name: "رهنان", lat: 32.6988, lng: 51.6185 },
      { name: "زینبیه", lat: 32.6915, lng: 51.7215 },
      { name: "دولت‌آباد", lat: 32.7315, lng: 51.701 },
      { name: "خوراسگان", lat: 32.6855, lng: 51.7795 },
      { name: "جی", lat: 32.6648, lng: 51.7115 },
      { name: "عاشق‌آباد", lat: 32.6815, lng: 51.741 },
      { name: "ارزنان", lat: 32.6765, lng: 51.7615 },
      { name: "قهجاورستان", lat: 32.7025, lng: 51.8315 },
      { name: "حصه", lat: 32.6945, lng: 51.751 },
      { name: "محمودآباد", lat: 32.681, lng: 51.7315 },
      { name: "ارغوانیه", lat: 32.6795, lng: 51.791 },
      { name: "کهندژ", lat: 32.6815, lng: 51.6485 },
      { name: "پنج‌آذر", lat: 32.7115, lng: 51.6515 },
      { name: "شیخ طوسی", lat: 32.7215, lng: 51.681 },
      { name: "ناصرخسرو", lat: 32.7055, lng: 51.6565 },
      { name: "نگارستان", lat: 32.7145, lng: 51.661 },
      { name: "بختیار دشت", lat: 32.7085, lng: 51.6915 },
      { name: "آزادان", lat: 32.7255, lng: 51.651 },
    ],
  },
  {
    title: "غرب و شهرک‌ها",
    items: [
      { name: "سیمین", lat: 32.6105, lng: 51.6245 },
      { name: "سه راه سیمین", lat: 32.610108, lng: 51.622979 },
      { name: "ناژوان", lat: 32.6415, lng: 51.5985 },
      { name: "درچه", lat: 32.6145, lng: 51.5545 },
      { name: "شهرک ولی‌عصر", lat: 32.6295, lng: 51.6195 },
      { name: "شهرک قدس", lat: 32.6395, lng: 51.6145 },
      { name: "شهرک شهید کشوری", lat: 32.6255, lng: 51.6415 },
      { name: "فیض", lat: 32.6455, lng: 51.6345 },
      { name: "وحید", lat: 32.6385, lng: 51.6448 },
      { name: "بزرگمهر", lat: 32.6485, lng: 51.6395 },
      { name: "آبشار", lat: 32.6305, lng: 51.6345 },
      { name: "آینه‌خانه", lat: 32.6355, lng: 51.6295 },
      { name: "خرم", lat: 32.6595, lng: 51.6395 },
      { name: "جامی", lat: 32.6575, lng: 51.6375 },
      { name: "صائب", lat: 32.6515, lng: 51.6445 },
      { name: "اشرفی اصفهانی", lat: 32.6405, lng: 51.6245 },
      { name: "گلخانه", lat: 32.6245, lng: 51.6095 },
      { name: "شهرک نگین", lat: 32.5945, lng: 51.6295 },
      { name: "فردوان", lat: 32.6055, lng: 51.6145 },
      { name: "بهار آزادی", lat: 32.6325, lng: 51.6485 },
      { name: "حسین‌آباد", lat: 32.6365, lng: 51.6415 },
      { name: "فرح‌آباد", lat: 32.6285, lng: 51.6525 },
    ],
  },
];

export const NEIGHBORHOODS = NEIGHBORHOOD_GROUPS.flatMap((group) => group.items);
export const NEIGHBORHOOD_NAMES = NEIGHBORHOODS.map((item) => item.name);

export const STEPS = [
  {
    id: "talk",
    title: "گفت‌وگوی اولیه",
    text: "نیاز، بودجه و محله را با هم مشخص می‌کنیم تا مسیر روشن شود.",
  },
  {
    id: "match",
    title: "معرفی فایل",
    text: "گزینه‌هایی متناسب با شرایط شما معرفی می‌شود؛ بدون اغراق و با جزئیات واقعی.",
  },
  {
    id: "visit",
    title: "بازدید هماهنگ",
    text: "زمان بازدید را تنظیم می‌کنیم و در محل همراه شما هستیم.",
  },
  {
    id: "deal",
    title: "قرارداد و پیگیری",
    text: "از توافق تا مدارک و انتقال، مسیر را قدم‌به‌قدم جلو می‌بریم.",
  },
] as const;

export const FAQS = [
  {
    q: "برای شروع مشاوره چه کار کنم؟",
    a: "از فرم درخواست ملک استفاده کنید یا با آقای شیخ (۰۹۱۳۱۰۵۶۰۲۹) و آقای مرادی (۰۹۱۸۳۵۷۶۸۸۳) تماس بگیرید تا درباره نیازتان راهنمایی شوید.",
  },
  {
    q: "محدوده فعالیت هیرمند کجاست؟",
    a: "تمرکز ما روی اصفهان است؛ از جلفا، مرداویج و سپاهان‌شهر تا شهرک ولی‌عصر، سیمین، ناژوان، خوراسگان، ملک‌شهر و ده‌ها محله دیگر. هر محله روی نقشه گوگل، بلد و نشان قابل مشاهده است.",
  },
  {
    q: "آیا فایل‌ها روی سایت به‌روز می‌شوند؟",
    a: "فایل‌های مناسب پس از گفت‌وگو و شناخت نیاز شما معرفی می‌شوند تا گزینه‌ها دقیق و مرتبط باشند.",
  },
  {
    q: "بازدید ملک چطور هماهنگ می‌شود؟",
    a: "پس از بررسی درخواست، زمان بازدید را با شما هماهنگ می‌کنیم و در محل همراهتان خواهیم بود.",
  },
  {
    q: "شماره تماس را چطور سریع داشته باشم؟",
    a: "از دکمه تماس بالای صفحه، آقای شیخ یا آقای مرادی را انتخاب کنید. کنار هر شماره دکمه کپی هم هست و می‌توانید در واتساپ، تلگرام، ایتا یا اینستاگرام پیام بفرستید.",
  },
  {
    q: "کمیسیون چطور محاسبه می‌شود؟",
    a: "در خرید و فروش، ۰٫۵٪ از مبلغ معامله به‌علاوه ۹٪ مالیات محاسبه و بین دو طرف نصف می‌شود. در رهن و اجاره، ۲۵٪ از اجاره ماهانه معادل (با تبدیل هر ۱ میلیون رهن به ۳۰ هزار تومان اجاره) به‌علاوه ۹٪ مالیات است. مبلغ نهایی با هماهنگی دفتر مشخص می‌شود.",
  },
  {
    q: "تبدیل رهن به اجاره یعنی چه؟",
    a: "در بازار ایران معمولاً هر ۱ میلیون تومان رهن معادل حدود ۳۰ هزار تومان اجاره ماهانه است. با نوار لغزنده می‌توانید همین ارزش را بین رهن بیشتر یا اجاره بیشتر جابه‌جا کنید.",
  },
  {
    q: "ابزار سود سپرده و اقساط وام چیست؟",
    a: "در بخش ابزار مالی می‌توانید سود تقریبی سپرده بانکی و قسط وام را بر اساس نرخ رایج بانک‌ها ببینید. این اعداد راهنما هستند و نرخ قطعی هر بانک ممکن است متفاوت باشد.",
  },
  {
    q: "ثبت قرارداد و کد رهگیری چیست؟",
    a: "برای همکاری املاک، از بخش باشگاه همکاران وارد حساب شوید و قرارداد را ثبت کنید. پس از تأیید هیرمند، کد رهگیری صادر می‌شود و وضعیت قرارداد و مهرهای کارت همکاری از همان بخش قابل پیگیری است.",
  },
] as const;

export const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "RealEstateAgent",
      "@id": `${SITE.url}#organization`,
      name: SITE.nameFa,
      alternateName: "Hirmand Real Estate Consultants",
      url: SITE.url,
      founder: "آقای شیخ",
      telephone: ["+989131056029", "+989183576883", "+983137850615"],
      description: SITE.description,
      image: `${SITE.url}/images/hirmand-logo.png`,
      address: {
        "@type": "PostalAddress",
        addressLocality: SITE.locality,
        addressCountry: "IR",
        streetAddress: "سه راه سیمین، خیابان جانبازان، بلوار شهید بخشی",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: SITE.lat,
        longitude: SITE.lng,
      },
      hasMap: SITE.mapUrl,
      areaServed: {
        "@type": "City",
        name: "اصفهان",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+989131056029",
        contactType: "customer service",
        availableLanguage: ["fa"],
      },
      employee: TEAM.map((person) => ({
        "@type": "Person",
        name: person.name,
        jobTitle: person.role,
        telephone: `+98${person.phone.slice(1)}`,
      })),
      sameAs: [SITE.instagram, SITE.telegram, SITE.eitaa, SITE.whatsappDirect],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}#website`,
      url: SITE.url,
      name: SITE.nameFa,
      inLanguage: "fa-IR",
      publisher: {
        "@id": `${SITE.url}#organization`,
      },
    },
  ],
};

export const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};
