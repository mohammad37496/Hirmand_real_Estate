import { useEffect, useState, type FormEvent } from "react";
import { Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SERVICES, SITE, TEAM } from "@/lib/site";
import { cn } from "@/lib/utils";
import { formatToman, parseAmount } from "@/lib/money";
import { listNeighborhoodNames } from "@/lib/neighborhoods";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatPersianDate } from "@/lib/persian-date";
import { PersianDatePicker } from "./persian-date-picker";

export type InquiryDraft = {
  deal: string;
  propertyType: string;
  neighborhood: string;
};

const DEAL_OPTIONS = SERVICES.map((item) => item.title);
const TYPE_OPTIONS = PROPERTY_TYPES.map((item) => item.title);

function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizePhone(value: string) {
  return toLatinDigits(value)
    .replace(/[\s\-()]/g, "")
    .replace(/^(\+98|0098|98)/, "0");
}

function isMobile(value: string) {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function InquiryForm({ draft }: { draft: InquiryDraft }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [job, setJob] = useState("");
  const [budgetDeposit, setBudgetDeposit] = useState("");
  const [budgetRent, setBudgetRent] = useState("");
  const [budgetPurchase, setBudgetPurchase] = useState("");
  const [budgetSale, setBudgetSale] = useState("");
  const [leaseDeadline, setLeaseDeadline] = useState("");
  const [deal, setDeal] = useState(draft.deal);
  const [propertyType, setPropertyType] = useState(draft.propertyType);
  const [neighborhood, setNeighborhood] = useState(draft.neighborhood);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<string[]>(NEIGHBORHOOD_NAMES);
  const [consultant, setConsultant] = useState<(typeof TEAM)[number]["id"]>(TEAM[0].id);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listNeighborhoodNames()
      .then((names) => {
        if (!cancelled && names.length) setNeighborhoodOptions(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (draft.deal) setDeal(draft.deal);
    if (draft.propertyType) setPropertyType(draft.propertyType);
    if (draft.neighborhood) setNeighborhood(draft.neighborhood);
  }, [draft]);

  const isRentLikeDeal = deal === "رهن" || deal === "اجاره";
  const isBuyDeal = deal === "خرید";
  const isSellDeal = deal === "فروش";

  function handleDealChange(value: string) {
    setDeal(value);
    if (value === "خرید") {
      setBudgetDeposit("");
      setBudgetRent("");
      setBudgetSale("");
      setLeaseDeadline("");
      return;
    }
    if (value === "فروش") {
      setBudgetDeposit("");
      setBudgetRent("");
      setBudgetPurchase("");
      setLeaseDeadline("");
      return;
    }
    if (value === "رهن" || value === "اجاره") {
      setBudgetPurchase("");
      setBudgetSale("");
      return;
    }
    setBudgetDeposit("");
    setBudgetRent("");
    setBudgetPurchase("");
    setBudgetSale("");
    setLeaseDeadline("");
  }

  const selected = TEAM.find((person) => person.id === consultant) ?? TEAM[0];

  function buildMessage() {
    return [
      `سلام، درخواست مشاوره از وب‌سایت ${SITE.nameFa}`,
      name ? `نام: ${name}` : "",
      phone ? `تلفن: ${normalizePhone(phone)}` : "",
      peopleCount ? `تعداد نفرات: ${peopleCount}` : "",
      job.trim() ? `شغل: ${job.trim()}` : "",
      isRentLikeDeal && parseAmount(budgetDeposit) > 0 ? `قیمت رهن: ${formatToman(parseAmount(budgetDeposit))} تومان` : "",
      isRentLikeDeal && parseAmount(budgetRent) > 0 ? `قیمت اجاره: ${formatToman(parseAmount(budgetRent))} تومان` : "",
      isBuyDeal && parseAmount(budgetPurchase) > 0 ? `مبلغ خرید: ${formatToman(parseAmount(budgetPurchase))} تومان` : "",
      isSellDeal && parseAmount(budgetSale) > 0 ? `مبلغ فروش: ${formatToman(parseAmount(budgetSale))} تومان` : "",
      isRentLikeDeal && leaseDeadline ? `مهلت رهن و اجاره: ${formatPersianDate(leaseDeadline)}` : "",
      deal ? `نوع معامله: ${deal}` : "",
      propertyType ? `نوع ملک: ${propertyType}` : "",
      neighborhood ? `محله: ${neighborhood}` : "",
      `مشاور: ${selected.name}`,
      note ? `توضیح: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("نام را وارد کنید.");
      return;
    }
    if (!isMobile(phone)) {
      setError("شماره موبایل را به‌صورت ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.");
      return;
    }
    const normalizedPeopleCount = toLatinDigits(peopleCount).replace(/[\s٬,]/g, "");
    const parsedPeopleCount = /^\d+$/.test(normalizedPeopleCount) ? Number(normalizedPeopleCount) : Number.NaN;
    if (!Number.isInteger(parsedPeopleCount) || parsedPeopleCount < 1 || parsedPeopleCount > 20) {
      setError("تعداد نفرات را بین ۱ تا ۲۰ نفر مشخص کنید.");
      return;
    }
    if (!job.trim()) {
      setError("شغل خود را وارد کنید.");
      return;
    }
    if (!deal) {
      setError("نوع معامله را انتخاب کنید.");
      return;
    }
    setError("");
    const budgetDepositNumber = isRentLikeDeal ? parseAmount(budgetDeposit) : 0;
    const budgetRentNumber = isRentLikeDeal ? parseAmount(budgetRent) : 0;
    const budgetPurchaseNumber = isBuyDeal ? parseAmount(budgetPurchase) : 0;
    const budgetSaleNumber = isSellDeal ? parseAmount(budgetSale) : 0;
    const payload = {
      name: name.trim(),
      phone: normalizePhone(phone),
      peopleCount: parsedPeopleCount,
      job: job.trim(),
      budgetDeposit: budgetDepositNumber || undefined,
      budgetRent: budgetRentNumber || undefined,
      budgetPurchase: budgetPurchaseNumber || undefined,
      budgetSale: budgetSaleNumber || undefined,
      leaseDeadline: isRentLikeDeal && leaseDeadline ? leaseDeadline : undefined,
      deal,
      propertyType,
      neighborhood,
      consultant: selected.name,
      note: note.trim(),
    };
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          peopleCount: payload.peopleCount,
          job: payload.job,
          budgetDeposit: payload.budgetDeposit,
          budgetRent: payload.budgetRent,
          budgetPurchase: payload.budgetPurchase,
          budgetSale: payload.budgetSale,
          leaseDeadline: payload.leaseDeadline,
          deal: payload.deal,
          propertyType: payload.propertyType,
          neighborhood: payload.neighborhood,
          consultant: payload.consultant,
          note: payload.note,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { success?: boolean; statusMessage?: string; message?: string }
        | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.statusMessage || result?.message || "ثبت درخواست انجام نشد.");
      }
      trackAnalyticsEvent("inquiry_submit");
      toast.success("درخواست شما با موفقیت برای تیم هیرمند ثبت شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت درخواست انجام نشد.");
      return;
    }
  }

  const waHref = `${selected.wa}?text=${encodeURIComponent(buildMessage())}`;

  return (
    <form className="inquiry-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="inq-name">نام و نام خانوادگی</label>
        <input
          id="inq-name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="مثلاً علی رضایی"
        />
      </div>
      <div className="field">
        <label htmlFor="inq-phone">شماره موبایل</label>
        <input
          id="inq-phone"
          name="phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0913 000 0000"
          aria-describedby="inq-phone-hint"
        />
      </div>
      <p id="inq-phone-hint" className="form-hint field-span">
        شماره با ارقام فارسی یا انگلیسی قابل وارد کردن است؛ درخواست شما در سامانه هیرمند ثبت می‌شود و اطلاعات فقط برای پیگیری همین درخواست استفاده خواهد شد.
      </p>
      <div className="field">
        <label htmlFor="inq-people-count">تعداد نفرات</label>
        <input
          id="inq-people-count"
          name="peopleCount"
          type="text"
          inputMode="numeric"
          dir="rtl"
          autoComplete="off"
          value={peopleCount}
          onChange={(event) => {
            const value = event.target.value;
            if (/^[0-9۰-۹٠-٩\s٬,]*$/.test(value)) setPeopleCount(value);
          }}
          onBlur={() => {
            const normalized = toLatinDigits(peopleCount).replace(/[\s٬,]/g, "");
            if (/^\d+$/.test(normalized)) {
              setPeopleCount(Number(normalized).toLocaleString("fa-IR"));
            }
          }}
          aria-describedby="inq-people-count-hint"
          placeholder="مثلاً ۴"
        />
        <small id="inq-people-count-hint" className="form-hint">
          ۱ تا ۲۰ نفر؛ ارقام فارسی، عربی یا انگلیسی پذیرفته می‌شود.
        </small>
      </div>
      <div className="field">
        <label htmlFor="inq-job">شغل</label>
        <input
          id="inq-job"
          name="job"
          autoComplete="organization-title"
          value={job}
          onChange={(event) => setJob(event.target.value)}
          placeholder="مثلاً کارمند، پزشک، دانشجو…"
        />
      </div>
      <div className="field">
        <label htmlFor="inq-deal">نوع معامله</label>
        <select id="inq-deal" value={deal} onChange={(event) => handleDealChange(event.target.value)}>
          <option value="">انتخاب کنید</option>
          {DEAL_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {isRentLikeDeal ? (
        <>
          <div className="field">
            <label htmlFor="inq-budget-deposit">قیمت رهن</label>
            <input
              id="inq-budget-deposit"
              name="budgetDeposit"
              inputMode="numeric"
              dir="rtl"
              value={budgetDeposit}
              onChange={(event) => setBudgetDeposit(event.target.value)}
              onBlur={() => {
                const amount = parseAmount(budgetDeposit);
                setBudgetDeposit(amount ? formatToman(amount) : "");
              }}
              placeholder="مثلاً ۵۰۰٬۰۰۰٬۰۰۰"
              aria-describedby="inq-budget-deposit-hint"
            />
            <small id="inq-budget-deposit-hint" className="form-hint">مبلغ رهن به تومان</small>
          </div>
          <div className="field">
            <label htmlFor="inq-budget-rent">قیمت اجاره</label>
            <input
              id="inq-budget-rent"
              name="budgetRent"
              inputMode="numeric"
              dir="rtl"
              value={budgetRent}
              onChange={(event) => setBudgetRent(event.target.value)}
              onBlur={() => {
                const amount = parseAmount(budgetRent);
                setBudgetRent(amount ? formatToman(amount) : "");
              }}
              placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰"
              aria-describedby="inq-budget-rent-hint"
            />
            <small id="inq-budget-rent-hint" className="form-hint">مبلغ اجاره ماهانه به تومان</small>
          </div>
        </>
      ) : isBuyDeal ? (
        <div className="field">
          <label htmlFor="inq-budget-purchase">مبلغ خرید</label>
          <input
            id="inq-budget-purchase"
            name="budgetPurchase"
            inputMode="numeric"
            dir="rtl"
            value={budgetPurchase}
            onChange={(event) => setBudgetPurchase(event.target.value)}
            onBlur={() => {
              const amount = parseAmount(budgetPurchase);
              setBudgetPurchase(amount ? formatToman(amount) : "");
            }}
            placeholder="مثلاً ۳٬۰۰۰٬۰۰۰٬۰۰۰"
            aria-describedby="inq-budget-purchase-hint"
          />
          <small id="inq-budget-purchase-hint" className="form-hint">بودجه خرید به تومان</small>
        </div>
      ) : isSellDeal ? (
        <div className="field">
          <label htmlFor="inq-budget-sale">مبلغ فروش</label>
          <input
            id="inq-budget-sale"
            name="budgetSale"
            inputMode="numeric"
            dir="rtl"
            value={budgetSale}
            onChange={(event) => setBudgetSale(event.target.value)}
            onBlur={() => {
              const amount = parseAmount(budgetSale);
              setBudgetSale(amount ? formatToman(amount) : "");
            }}
            placeholder="مثلاً ۵٬۰۰۰٬۰۰۰٬۰۰۰"
            aria-describedby="inq-budget-sale-hint"
          />
          <small id="inq-budget-sale-hint" className="form-hint">مبلغ فروش به تومان</small>
        </div>
      ) : null}
      {isRentLikeDeal ? (
        <div className="field field-span inquiry-deadline-field">
          <label htmlFor="inq-lease-deadline">مهلت رهن و اجاره</label>
          <PersianDatePicker
            id="inq-lease-deadline"
            value={leaseDeadline}
            onChange={setLeaseDeadline}
            placeholder="انتخاب مهلت به تاریخ شمسی"
            hint="اختیاری؛ تاریخ مهلت را با تقویم شمسی انتخاب کنید."
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="inq-type">نوع ملک</label>
        <select
          id="inq-type"
          value={propertyType}
          onChange={(event) => setPropertyType(event.target.value)}
        >
          <option value="">انتخاب کنید</option>
          {TYPE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="inq-area">محله مورد نظر</label>
        <select
          id="inq-area"
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
        >
          <option value="">فرقی ندارد / بعداً مشخص می‌شود</option>
          {neighborhoodOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="inq-consultant">مشاور</label>
        <select
          id="inq-consultant"
          value={consultant}
          onChange={(event) => setConsultant(event.target.value as (typeof TEAM)[number]["id"])}
        >
          {TEAM.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} — {person.role}
            </option>
          ))}
        </select>
      </div>
      <div className="field field-span">
        <label htmlFor="inq-note">توضیحات</label>
        <textarea
          id="inq-note"
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="متراژ، بودجه حدودی، تعداد خواب یا هر نکته‌ای که کمک کند دقیق‌تر راهنمایی شویم."
        />
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn-gold">
          ثبت درخواست
        </button>
        <a
          className={cn("btn-ghost")}
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackAnalyticsEvent("whatsapp_click")}
        >
          <Send size={16} />
          ارسال در واتساپ
        </a>
        <a
          className="btn-ghost"
          href={`tel:${selected.phone}`}
          onClick={() => trackAnalyticsEvent("call_click")}
        >
          <Phone size={16} />
          تماس با {selected.name}
        </a>
      </div>
    </form>
  );
}
