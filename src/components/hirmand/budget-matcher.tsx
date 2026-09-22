import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeftRight,
  BedDouble,
  Calculator,
  CheckCircle2,
  ChevronDown,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PROPERTY_TYPES, NEIGHBORHOOD_NAMES, SITE, TEAM } from "@/lib/site";
import { DEFAULT_RAHN_RATE, RAHN_RATE_PRESETS } from "@/lib/finance";
import { formatToman, parseAmount } from "@/lib/money";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  matchPublishedPropertiesByBudget,
  type PropertyBudgetMatch,
  type PropertyType,
} from "@/lib/properties";
import { PropertyCard } from "./property-showcase";

const TIER_META = {
  within: {
    label: "کاملاً داخل بودجه",
    shortLabel: "داخل بودجه",
    tone: "within",
    icon: CheckCircle2,
    description: "ترکیب فعلی رهن و اجاره از سقف تعیین‌شده شما عبور نمی‌کند.",
  },
  convertible: {
    label: "با ترکیب مالی",
    shortLabel: "قابل تبدیل",
    tone: "convertible",
    icon: ArrowLeftRight,
    description: "ارزش فایل داخل بودجه کل شماست، اما ترکیب رهن و اجاره نیاز به جابه‌جایی دارد.",
  },
  near: {
    label: "نزدیک به بودجه",
    shortLabel: "نزدیک بودجه",
    tone: "near",
    icon: Target,
    description: "فایل کمی بالاتر از سقف شماست و برای مذاکره یا بررسی استثنا پیشنهاد شده است.",
  },
} as const;

const DEPOSIT_PRESETS = [300_000_000, 500_000_000, 800_000_000];
const RENT_PRESETS = [5_000_000, 10_000_000, 15_000_000];

function cleanInput(value: string) {
  const amount = parseAmount(value);
  return amount ? amount.toLocaleString("fa-IR") : "";
}

function amountText(value: string) {
  const parsed = parseAmount(value);
  return parsed ? formatToman(parsed) : "۰";
}

function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s\-()]/g, "")
    .replace(/^(?:\+98|0098|98)/, "0");
}

function conversionText(match: PropertyBudgetMatch) {
  if (match.tier !== "convertible") return "";
  const deposit = formatToman(match.suggestedDeposit);
  const rent = formatToman(match.suggestedRent);
  if (match.conversionDirection === "deposit_to_rent") {
    return `پیشنهاد مالی: رهن ${deposit} + اجاره ${rent} تومان؛ بخشی از رهن فایل به اجاره تبدیل شده است.`;
  }
  if (match.conversionDirection === "rent_to_deposit") {
    return `پیشنهاد مالی: رهن ${deposit} + اجاره ${rent} تومان؛ بخشی از اجاره فایل به رهن تبدیل شده است.`;
  }
  return `پیشنهاد مالی: رهن ${deposit} + اجاره ${rent} تومان.`;
}

export function BudgetMatcher() {
  const [deposit, setDeposit] = useState("");
  const [rent, setRent] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consultant, setConsultant] = useState<(typeof TEAM)[number]["id"]>(TEAM[0].id);
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [neighborhood, setNeighborhood] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [matches, setMatches] = useState<PropertyBudgetMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const depositNumber = useMemo(() => parseAmount(deposit), [deposit]);
  const rentNumber = useMemo(() => parseAmount(rent), [rent]);
  const totalEquivalent = useMemo(
    () => depositNumber + (rentNumber * 1_000_000) / DEFAULT_RAHN_RATE,
    [depositNumber, rentNumber],
  );

  const resultStats = useMemo(
    () => ({
      within: matches.filter((match) => match.tier === "within").length,
      convertible: matches.filter((match) => match.tier === "convertible").length,
      near: matches.filter((match) => match.tier === "near").length,
    }),
    [matches],
  );

  async function search(event: FormEvent) {
    event.preventDefault();
    if (depositNumber <= 0 && rentNumber <= 0) {
      toast.error("برای شروع، حداقل سقف رهن یا اجاره ماهانه را وارد کنید.");
      return;
    }

    setLoading(true);
    setSearched(true);
    setLeadSaved(false);
    trackAnalyticsEvent("budget_match_submit");

    try {
      const rows = await matchPublishedPropertiesByBudget({
        data: {
          depositBudget: Math.round(depositNumber),
          rentBudget: Math.round(rentNumber),
          propertyType: propertyType || undefined,
          neighborhood: neighborhood || undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          limit: 12,
        },
      });
      setMatches(rows);
      if (!rows.length) {
        toast.info("در بازه فعلی فایلی پیدا نشد؛ درخواست شخصی‌سازی‌شده هنوز می‌تواند نتیجه بدهد.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تطبیق بودجه انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBudgetLead(event: FormEvent) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!name.trim()) {
      toast.error("نام و نام خانوادگی را وارد کنید.");
      return;
    }
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      toast.error("شماره موبایل معتبر وارد کنید.");
      return;
    }

    setLeadSaving(true);
    try {
      const selected = TEAM.find((person) => person.id === consultant) ?? TEAM[0];
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizedPhone,
          deal: "رهن و اجاره",
          propertyType,
          neighborhood,
          consultant: selected.name,
          source: "budget_match",
          budgetDeposit: Math.round(depositNumber),
          budgetRent: Math.round(rentNumber),
          budgetBedrooms: bedrooms ? Number(bedrooms) : undefined,
          matches: matches.slice(0, 12).map((match) => ({
            slug: match.property.slug,
            title: match.property.title,
            tier: match.tier,
            score: match.score,
            suggestedDeposit: match.suggestedDeposit,
            suggestedRent: match.suggestedRent,
            gapEquivalent: match.gapEquivalent,
            reason: match.reason,
          })),
          note: "درخواست پیگیری از جستجوی هوشمند بودجه؛ بودجه کل و ترکیب مالی در نتیجه ثبت شده است.",
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        statusMessage?: string;
        message?: string;
      } | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.statusMessage || result?.message || "ثبت درخواست انجام نشد.");
      }
      setLeadSaved(true);
      trackAnalyticsEvent("budget_match_contact");
      toast.success("درخواست پیگیری برای تیم هیرمند ثبت شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت درخواست انجام نشد.");
    } finally {
      setLeadSaving(false);
    }
  }

  function reset() {
    setDeposit("");
    setRent("");
    setPropertyType("");
    setNeighborhood("");
    setBedrooms("");
    setMatches([]);
    setSearched(false);
    setLeadSaved(false);
  }

  const budgetReady = depositNumber > 0 || rentNumber > 0;

  return (
    <section className="budget-matcher" id="budget-match" aria-labelledby="budget-match-title">
      <div className="budget-matcher-hero">
        <div className="budget-matcher-hero-copy">
          <div className="budget-matcher-eyebrow">
            <span className="budget-matcher-eyebrow-dot" />
            جستجوی هوشمند رهن و اجاره
          </div>
          <h2 id="budget-match-title">بودجه‌تان را بگویید؛ فایل مناسب را پیدا می‌کنیم.</h2>
          <p>
            سقف رهن و اجاره را وارد کنید. هیرمند فایل‌های منتشرشده را از نظر ارزش مالی، ترکیب پرداخت،
            محله و تعداد خواب بررسی می‌کند و برای هر گزینه توضیح می‌دهد چرا به بودجه شما نزدیک است.
          </p>
          <div className="budget-matcher-trust">
            <span><Calculator size={14} /> محاسبه با معادل رهنی</span>
            <span><Sparkles size={14} /> رتبه‌بندی بر اساس میزان تطبیق</span>
            <span><UserRound size={14} /> امکان پیگیری توسط مشاور</span>
          </div>
        </div>
        <div className="budget-matcher-hero-mark" aria-hidden="true">
          <WalletCards size={38} strokeWidth={1.35} />
          <span>HIRMAND MATCH</span>
        </div>
      </div>

      <div className="budget-matcher-layout">
        <div className="budget-matcher-main">
          <form className="budget-matcher-form" onSubmit={search}>
            <div className="budget-form-section">
              <div className="budget-form-heading">
                <div>
                  <span className="budget-step">۰۱</span>
                  <div>
                    <strong>سقف مالی شما</strong>
                    <p>حداکثر مبلغی که واقعاً برای پرداخت ماهانه و ودیعه در نظر گرفته‌اید.</p>
                  </div>
                </div>
                <span className="budget-form-badge">ضروری</span>
              </div>

              <div className="budget-money-grid">
                <label className="budget-money-card">
                  <span>حداکثر رهن</span>
                  <div className="budget-input-wrap">
                    <input
                      inputMode="numeric"
                      dir="rtl"
                      value={deposit}
                      onChange={(event) => setDeposit(event.target.value)}
                      onBlur={() => setDeposit(cleanInput(deposit))}
                      placeholder="مثلاً ۵۰۰ میلیون"
                      aria-label="حداکثر مبلغ رهن"
                    />
                    <small>تومان</small>
                  </div>
                  <div className="budget-presets" aria-label="مقادیر سریع رهن">
                    {DEPOSIT_PRESETS.map((value) => (
                      <button key={value} type="button" onClick={() => setDeposit(formatToman(value))}>
                        <><b>{formatToman(value / 1_000_000)}</b><span>میلیون</span></>
                      </button>
                    ))}
                  </div>
                </label>

                <label className="budget-money-card">
                  <span>حداکثر اجاره ماهانه</span>
                  <div className="budget-input-wrap">
                    <input
                      inputMode="numeric"
                      dir="rtl"
                      value={rent}
                      onChange={(event) => setRent(event.target.value)}
                      onBlur={() => setRent(cleanInput(rent))}
                      placeholder="مثلاً ۱۰ میلیون"
                      aria-label="حداکثر اجاره ماهانه"
                    />
                    <small>تومان</small>
                  </div>
                  <div className="budget-presets" aria-label="مقادیر سریع اجاره">
                    {RENT_PRESETS.map((value) => (
                      <button key={value} type="button" onClick={() => setRent(formatToman(value))}>
                        <b>{formatToman(value / 1_000_000)}</b><span>میلیون</span>
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <div className={budgetReady ? "budget-live-equivalent is-ready" : "budget-live-equivalent"}>
                <div className="budget-live-icon"><Calculator size={18} /></div>
                <div>
                  <span>معادل رهنی بودجه شما</span>
                  <strong>{formatToman(totalEquivalent)} تومان</strong>
                </div>
                <small>۱ میلیون رهن ≈ {formatToman(DEFAULT_RAHN_RATE)} تومان اجاره</small>
              </div>
            </div>

            <div className="budget-form-section budget-preference-section">
              <button
                type="button"
                className="budget-advanced-toggle"
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
              >
                <span>
                  <SlidersHorizontal size={17} />
                  ترجیحات جستجو
                  <small>نوع ملک، محله و تعداد خواب را مشخص کنید.</small>
                </span>
                <ChevronDown size={18} className={advancedOpen ? "is-open" : ""} />
              </button>

              {advancedOpen ? (
                <div className="budget-preference-grid">
                  <label className="field">
                    <span><WalletCards size={14} /> نوع ملک</span>
                    <select value={propertyType} onChange={(event) => setPropertyType(event.target.value as PropertyType | "")}>
                      <option value="">همه انواع ملک</option>
                      {PROPERTY_TYPES.map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span><MapPin size={14} /> محله</span>
                    <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
                      <option value="">همه محله‌ها</option>
                      {NEIGHBORHOOD_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span><BedDouble size={14} /> حداقل خواب</span>
                    <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
                      <option value="">فرقی ندارد</option>
                      <option value="1">۱ خواب و بیشتر</option>
                      <option value="2">۲ خواب و بیشتر</option>
                      <option value="3">۳ خواب و بیشتر</option>
                      <option value="4">۴ خواب و بیشتر</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>

            <div className="budget-form-actions">
              <button type="submit" className="btn-gold budget-search-button" disabled={loading}>
                {loading ? <RefreshCw size={17} className="budget-spin" /> : <Search size={17} />}
                {loading ? "در حال تحلیل فایل‌ها…" : "شروع جستجوی هوشمند"}
              </button>
              {searched ? (
                <button type="button" className="btn-ghost budget-reset-button" onClick={reset}>
                  <RefreshCw size={16} />
                  شروع دوباره
                </button>
              ) : null}
            </div>
          </form>

          <div className="budget-matcher-footnote">
            <ArrowLeftRight size={15} />
            <span>
              تبدیل رهن و اجاره در این ابزار فقط برای مقایسه مالی است و به معنی توافق قطعی با مالک نیست.
              نرخ محاسبه فعلی: {RAHN_RATE_PRESETS.map((value) => formatToman(value)).join(" / ")} تومان برای هر ۱ میلیون رهن.
            </span>
          </div>
        </div>

        <aside className="budget-matcher-side">
          <div className="budget-side-card">
            <span className="kicker">نمایش زنده بودجه</span>
            <div className="budget-side-total">
              <strong>{formatToman(totalEquivalent)}</strong>
              <small>تومان معادل رهن</small>
            </div>
            <div className="budget-side-lines">
              <div><span>رهن</span><strong>{amountText(deposit)} تومان</strong></div>
              <div><span>اجاره</span><strong>{amountText(rent)} تومان</strong></div>
            </div>
            <div className="budget-side-note">
              <Calculator size={15} />
              <span>بودجه‌ی ترکیبی با نرخ جاری سیستم محاسبه می‌شود.</span>
            </div>
          </div>

          <div className="budget-side-card budget-side-method">
            <div className="budget-side-method-head">
              <Target size={18} />
              <strong>چطور تطبیق می‌دهیم؟</strong>
            </div>
            <div className="budget-method-row">
              <span>۱</span>
              <p><strong>داخل بودجه</strong><small>رهن و اجاره فایل هر دو زیر سقف شما هستند.</small></p>
            </div>
            <div className="budget-method-row">
              <span>۲</span>
              <p><strong>قابل تبدیل</strong><small>ارزش کل داخل بودجه است و یک ترکیب جایگزین محاسبه می‌کنیم.</small></p>
            </div>
            <div className="budget-method-row">
              <span>۳</span>
              <p><strong>نزدیک بودجه</strong><small>کمی بالاتر است و برای بررسی مذاکره‌ای نگه داشته می‌شود.</small></p>
            </div>
          </div>
        </aside>
      </div>

      {searched ? (
        <div className="budget-results" aria-live="polite">
          <div className="budget-results-intro">
            <div>
              <span className="kicker">۰۲ · نتیجه تحلیل</span>
              <h3>{matches.length ? "این‌ها نزدیک‌ترین فایل‌ها به بودجه شما هستند." : "برای این ترکیب بودجه، نتیجه مستقیمی پیدا نشد."}</h3>
              <p>
                {matches.length
                  ? "هر کارت، هم امتیاز تطبیق دارد و هم توضیح می‌دهد چه اتفاقی برای ترکیب مالی افتاده است."
                  : "می‌توانید فیلترها را بازتر کنید یا درخواست اختصاصی ثبت کنید تا فایل‌های خارج از لیست عمومی هم بررسی شوند."}
              </p>
            </div>
            <div className="budget-results-count">
              <strong>{matches.length.toLocaleString("fa-IR")}</strong>
              <span>فایل پیشنهادی</span>
            </div>
          </div>

          {matches.length ? (
            <>
              <div className="budget-result-summary">
                {(["within", "convertible", "near"] as const).map((tier) => {
                  const meta = TIER_META[tier];
                  const Icon = meta.icon;
                  return (
                    <div key={tier} data-tone={meta.tone}>
                      <span className="budget-summary-icon"><Icon size={16} /></span>
                      <span><strong>{resultStats[tier].toLocaleString("fa-IR")}</strong><small>{meta.shortLabel}</small></span>
                    </div>
                  );
                })}
              </div>

              <div className="budget-result-grid">
                {matches.map((match, index) => {
                  const meta = TIER_META[match.tier];
                  const Icon = meta.icon;
                  return (
                    <article key={match.property.id} className="budget-result-item">
                      <div className="budget-result-head">
                        <div className="budget-result-badges">
                          <span className={"budget-tier-badge tone-" + meta.tone}><Icon size={13} /> {meta.shortLabel}</span>
                          <span className="budget-score"><Sparkles size={12} /> {match.score.toLocaleString("fa-IR")}%</span>
                        </div>
                        <span className="budget-result-rank">#{(index + 1).toLocaleString("fa-IR")}</span>
                      </div>

                      <PropertyCard property={match.property} />

                      <div className="budget-match-explanation" data-tier={match.tier}>
                        <div className="budget-match-explanation-icon">
                          <Icon size={16} />
                        </div>
                        <div>
                          <strong>{meta.label}</strong>
                          <p>{match.reason}</p>
                          {conversionText(match) ? <span>{conversionText(match)}</span> : null}
                          {match.tier === "near" ? (
                            <span>حدود <b>{formatToman(match.gapEquivalent)}</b> تومان معادل رهن بالاتر از سقف شماست.</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="budget-match-metrics">
                        <div>
                          <span>مصرف بودجه</span>
                          <strong>{match.budgetUsagePercent.toLocaleString("fa-IR")}٪</strong>
                        </div>
                        <div>
                          <span>معادل فایل</span>
                          <strong>{formatToman(match.propertyTotalEquivalent)}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="budget-empty budget-empty-premium">
              <div className="budget-empty-icon"><Search size={25} /></div>
              <div>
                <strong>نتیجه مستقیم پیدا نشد؛ جستجو هنوز تمام نشده.</strong>
                <p>فیلترهای نوع ملک، محله یا خواب را بازتر کنید، یا درخواستتان را ثبت کنید تا مشاور هیرمند گزینه‌های بیشتری را بررسی کند.</p>
              </div>
              <Link to="/" hash="inquiry" className="btn-gold" onClick={() => trackAnalyticsEvent("budget_match_contact")}>
                ثبت درخواست اختصاصی
              </Link>
            </div>
          )}

          {!leadSaved ? (
            <form className="budget-lead-form" onSubmit={saveBudgetLead}>
              <div className="budget-lead-copy">
                <span className="kicker">۰۳ · پیگیری انسانی</span>
                <h3>نتیجه را بسپارید به مشاور هیرمند.</h3>
                <p>
                  بودجه، ترجیحات و فایل‌های پیشنهادی شما داخل CRM ثبت می‌شود تا پیگیری دقیق‌تری انجام شود.
                  لازم نیست دوباره اطلاعات را برای مشاور توضیح بدهید.
                </p>
                <div className="budget-lead-mini"><MessageCircle size={15} /> پاسخ‌گویی و هماهنگی بازدید پس از ثبت درخواست</div>
              </div>

              <div className="budget-lead-fields">
                <label className="field">
                  <span>نام و نام خانوادگی</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="مثلاً علی رضایی" />
                </label>
                <label className="field">
                  <span>شماره موبایل</span>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="0913 000 0000" />
                </label>
                <label className="field">
                  <span>مشاور پیگیر</span>
                  <select value={consultant} onChange={(event) => setConsultant(event.target.value as (typeof TEAM)[number]["id"])}>
                    {TEAM.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}
                  </select>
                </label>
                <button type="submit" className="btn-gold budget-lead-submit" disabled={leadSaving}>
                  {leadSaving ? "در حال ثبت درخواست…" : "ثبت و ارسال به مشاور"}
                </button>
              </div>
            </form>
          ) : (
            <div className="budget-lead-success">
              <div className="budget-success-icon"><CheckCircle2 size={22} /></div>
              <div>
                <strong>درخواست شما با موفقیت ثبت شد.</strong>
                <p>بودجه و نتیجه تطبیق در CRM هیرمند ذخیره شده است و مشاور منتخب می‌تواند آن را پیگیری کند.</p>
              </div>
              <a
                className="btn-ghost"
                href={TEAM.find((person) => person.id === consultant)?.wa ?? SITE.whatsappDirect}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} /> ادامه در واتساپ
              </a>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
