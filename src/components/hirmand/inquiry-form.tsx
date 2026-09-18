import { useEffect, useState, type FormEvent } from "react";
import { Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SERVICES, SITE, TEAM } from "@/lib/site";
import { cn } from "@/lib/utils";

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
  const [deal, setDeal] = useState(draft.deal);
  const [propertyType, setPropertyType] = useState(draft.propertyType);
  const [neighborhood, setNeighborhood] = useState(draft.neighborhood);
  const [consultant, setConsultant] = useState<(typeof TEAM)[number]["id"]>(TEAM[0].id);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (draft.deal) setDeal(draft.deal);
    if (draft.propertyType) setPropertyType(draft.propertyType);
    if (draft.neighborhood) setNeighborhood(draft.neighborhood);
  }, [draft]);

  const selected = TEAM.find((person) => person.id === consultant) ?? TEAM[0];

  function buildMessage() {
    return [
      `سلام، درخواست مشاوره از وب‌سایت ${SITE.nameFa}`,
      name ? `نام: ${name}` : "",
      phone ? `تلفن: ${normalizePhone(phone)}` : "",
      deal ? `نوع معامله: ${deal}` : "",
      propertyType ? `نوع ملک: ${propertyType}` : "",
      neighborhood ? `محله: ${neighborhood}` : "",
      `مشاور: ${selected.name}`,
      note ? `توضیح: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("نام را وارد کنید.");
      return;
    }
    if (!isMobile(phone)) {
      setError("شماره موبایل را به‌صورت ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.");
      return;
    }
    if (!deal) {
      setError("نوع معامله را انتخاب کنید.");
      return;
    }
    setError("");
    const payload = {
      name: name.trim(),
      phone: normalizePhone(phone),
      deal,
      propertyType,
      neighborhood,
      consultant: selected.name,
      note: note.trim(),
      at: new Date().toISOString(),
    };
    try {
      const prev = JSON.parse(localStorage.getItem("hirmand-inquiries") || "[]") as unknown[];
      localStorage.setItem("hirmand-inquiries", JSON.stringify([payload, ...prev].slice(0, 20)));
    } catch {
      /* ignore quota */
    }
    toast.success("درخواست ثبت شد. می‌توانید در واتساپ ادامه دهید.");
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
        شماره با ارقام فارسی یا انگلیسی قابل وارد کردن است؛ اطلاعات این فرم فقط برای آماده‌سازی درخواست و ارسال به مشاور در همین دستگاه نگهداری می‌شود.
      </p>
      <div className="field">
        <label htmlFor="inq-deal">نوع معامله</label>
        <select id="inq-deal" value={deal} onChange={(event) => setDeal(event.target.value)}>
          <option value="">انتخاب کنید</option>
          {DEAL_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
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
          {NEIGHBORHOOD_NAMES.map((item) => (
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
        <a className={cn("btn-ghost")} href={waHref} target="_blank" rel="noopener noreferrer">
          <Send size={16} />
          ارسال در واتساپ
        </a>
        <a className="btn-ghost" href={`tel:${selected.phone}`}>
          <Phone size={16} />
          تماس با {selected.name}
        </a>
      </div>
    </form>
  );
}
