import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, Filter, Search, Sparkles, WalletCards } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PROPERTY_TYPES, NEIGHBORHOOD_NAMES } from "@/lib/site";
import { DEFAULT_RAHN_RATE, RAHN_RATE_PRESETS } from "@/lib/finance";
import { formatGroupedInput, formatToman, parseAmount } from "@/lib/money";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  matchPublishedPropertiesByBudget,
  type PropertyBudgetMatch,
} from "@/lib/properties";
import { PropertyCard } from "./property-showcase";

const TIER_LABELS = {
  within: "داخل بودجه",
  convertible: "قابل تبدیل",
  near: "کمی بالاتر",
} as const;

function cleanInput(value: string) {
  const amount = parseAmount(value);
  return amount ? amount.toLocaleString("fa-IR") : "";
}

function amountText(value: string) {
  const parsed = parseAmount(value);
  return parsed ? formatToman(parsed) : "۰";
}

export function BudgetMatcher() {
  const [deposit, setDeposit] = useState("");
  const [rent, setRent] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [matches, setMatches] = useState<PropertyBudgetMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const depositBudget = parseAmount(deposit);
    const rentBudget = parseAmount(rent);

    if (depositBudget <= 0 && rentBudget <= 0) {
      toast.error("حداقل یکی از مبلغ رهن یا اجاره را وارد کنید.");
      return;
    }

    setLoading(true);
    setSearched(true);
    trackAnalyticsEvent("budget_match_submit");

    try {
      const rows = await matchPublishedPropertiesByBudget({
        data: {
          depositBudget,
          rentBudget,
          propertyType: propertyType || undefined,
          neighborhood: neighborhood || undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          limit: 12,
        },
      });
      setMatches(rows);
      if (!rows.length) {
        toast.info("فایل نزدیک به این بودجه پیدا نشد؛ درخواست شخصی‌سازی‌شده ثبت کنید.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "جستجوی بودجه انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  const depositNumber = parseAmount(deposit);
  const rentNumber = parseAmount(rent);
  const totalEquivalent = depositNumber + (rentNumber * 1_000_000) / DEFAULT_RAHN_RATE;

  return (
    <section className="budget-matcher" id="budget-match">
      <div className="budget-matcher-head">
        <div>
          <span className="kicker">جستجوی هوشمند بودجه</span>
          <h2>بگویید چقدر رهن و اجاره می‌توانید بدهید</h2>
          <p>
            هیرمند فایل‌های رهن و اجاره را با بودجه شما مقایسه می‌کند؛ هم گزینه‌های داخل بودجه را می‌بینید،
            هم فایل‌هایی که با تبدیل بخشی از رهن به اجاره قابل نزدیک شدن هستند.
          </p>
        </div>
        <div className="budget-matcher-icon" aria-hidden="true">
          <WalletCards size={32} strokeWidth={1.5} />
        </div>
      </div>

      <form className="budget-matcher-form" onSubmit={search}>
        <label className="field budget-money-field">
          <span>حداکثر رهنی که دارید</span>
          <div className="budget-input-wrap">
            <input
              inputMode="numeric"
              value={deposit}
              onChange={(event) => setDeposit(event.target.value)}
              onBlur={() => setDeposit(cleanInput(deposit))}
              placeholder="مثلاً ۵۰۰ میلیون"
              aria-label="حداکثر مبلغ رهن"
            />
            <small>تومان</small>
          </div>
        </label>

        <label className="field budget-money-field">
          <span>حداکثر اجاره ماهانه</span>
          <div className="budget-input-wrap">
            <input
              inputMode="numeric"
              value={rent}
              onChange={(event) => setRent(event.target.value)}
              onBlur={() => setRent(cleanInput(rent))}
              placeholder="مثلاً ۱۰ میلیون"
              aria-label="حداکثر اجاره ماهانه"
            />
            <small>تومان</small>
          </div>
        </label>

        <label className="field">
          <span>نوع ملک</span>
          <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
            <option value="">همه انواع ملک</option>
            {PROPERTY_TYPES.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>محله</span>
          <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
            <option value="">همه محله‌ها</option>
            {NEIGHBORHOOD_NAMES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label className="field">
          <span>حداقل خواب</span>
          <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
            <option value="">فرقی ندارد</option>
            <option value="1">۱ خواب و بیشتر</option>
            <option value="2">۲ خواب و بیشتر</option>
            <option value="3">۳ خواب و بیشتر</option>
            <option value="4">۴ خواب و بیشتر</option>
          </select>
        </label>

        <button type="submit" className="btn-gold budget-search-button" disabled={loading}>
          {loading ? <Search size={17} className="admin-spin" /> : <Search size={17} />}
          {loading ? "در حال تطبیق..." : "پیدا کردن فایل‌های مناسب"}
        </button>
      </form>

      <div className="budget-matcher-summary">
        <div>
          <span>رهن شما</span>
          <strong>{amountText(deposit)} تومان</strong>
        </div>
        <div>
          <span>اجاره شما</span>
          <strong>{amountText(rent)} تومان</strong>
        </div>
        <div className="budget-equivalent">
          <span>معادل رهنی کل</span>
          <strong>{formatToman(totalEquivalent)} تومان</strong>
          <small>با نرخ هر ۱ میلیون رهن ≈ {formatToman(DEFAULT_RAHN_RATE)} تومان اجاره</small>
        </div>
      </div>

      {searched ? (
        <div className="budget-results">
          <div className="budget-results-head">
            <div>
              <span className="kicker">نتیجه تطبیق</span>
              <h3>{matches.length.toLocaleString("fa-IR")} فایل برای بودجه شما</h3>
            </div>
            <div className="budget-result-key">
              <span><i data-tier="within" /> داخل بودجه</span>
              <span><i data-tier="convertible" /> قابل تبدیل</span>
              <span><i data-tier="near" /> نزدیک بودجه</span>
            </div>
          </div>

          {matches.length ? (
            <div className="budget-result-grid">
              {matches.map((match) => (
                <div key={match.property.id} className="budget-result-item">
                  <div className="budget-result-badges">
                    <span data-tier={match.tier}>{TIER_LABELS[match.tier]}</span>
                    <span className="budget-score"><Sparkles size={12} /> {match.score.toLocaleString("fa-IR")}% تطبیق</span>
                  </div>
                  <PropertyCard property={match.property} />
                  <div className="budget-result-note">
                    {match.tier === "convertible" ? (
                      <>
                        <CheckCircle2 size={15} />
                        <span>
                          پیشنهاد ترکیب: <strong>رهن {formatToman(match.suggestedDeposit)}</strong>
                          {" + "}
                          <strong>اجاره {formatToman(match.suggestedRent)}</strong> تومان
                        </span>
                      </>
                    ) : match.tier === "near" ? (
                      <>
                        <Filter size={15} />
                        <span>
                          حدود <strong>{formatToman(Math.max(0, match.gapEquivalent))}</strong> تومان
                          معادل رهن از بودجه شما بالاتر است.
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>ترکیب فعلی رهن و اجاره این فایل داخل سقف بودجه شماست.</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="budget-empty">
              <WalletCards size={26} />
              <strong>فایل مناسب دقیق پیدا نشد</strong>
              <p>فیلترها را کمی بازتر کنید یا درخواست مستقیم بفرستید تا مشاور فایل‌های خارج از لیست عمومی را هم بررسی کند.</p>
              <Link to="/" hash="inquiry" className="btn-gold" onClick={() => trackAnalyticsEvent("budget_match_contact")}>
                ثبت درخواست برای مشاور
              </Link>
            </div>
          )}

          {matches.length ? (
            <div className="budget-contact-cta">
              <div>
                <strong>چند گزینه مناسب پیدا شد؟</strong>
                <p>برای بازدید و بررسی شرایط مالک، درخواستتان را مستقیم برای هیرمند بفرستید.</p>
              </div>
              <Link to="/" hash="inquiry" className="btn-gold" onClick={() => trackAnalyticsEvent("budget_match_contact")}>
                ثبت درخواست و بازدید
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="budget-matcher-footnote">
        <ArrowLeftRight size={15} />
        <span>
          تبدیل رهن و اجاره فقط یک معیار مقایسه است؛ پذیرش ترکیب جدید به توافق مالک و شرایط هر فایل بستگی دارد.
          نرخ پیش‌فرض این ابزار {RAHN_RATE_PRESETS.map((value) => formatToman(value)).join(" / ")} تومان است.
        </span>
      </div>
    </section>
  );
}
