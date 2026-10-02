import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FilePlus2, Home, Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PROPERTY_TYPES, SERVICES, NEIGHBORHOODS, SITE } from "@/lib/site";
import { formatToman, parseAmount } from "@/lib/money";
import "@/owner-property.css";

function digits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function formatMoney(value: string) {
  const normalized = digits(value).replace(/[^0-9]/g, "");
  return normalized ? Number(normalized).toLocaleString("fa-IR") : "";
}

function normalizePhone(value: string) {
  return digits(value).replace(/\D/g, "").replace(/^(\+98|0098|98)/, "0");
}

export const Route = createFileRoute("/submit-property")({
  head: () => ({
    meta: [
      { title: `ثبت ملک توسط مالک | ${SITE.nameFa}` },
      {
        name: "description",
        content: "ثبت اولیه رایگان ملک برای فروش یا اجاره توسط مالک در سامانه هیرمند.",
      },
    ],
  }),
  component: SubmitPropertyPage,
});

function SubmitPropertyPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deal, setDeal] = useState("فروش");
  const [propertyType, setPropertyType] = useState("آپارتمان");
  const [neighborhood, setNeighborhood] = useState("");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [rent, setRent] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (name.trim().length < 2) {
      setError("نام و نام خانوادگی را وارد کنید.");
      return;
    }
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل معتبر وارد کنید.");
      return;
    }
    if (!neighborhood.trim()) {
      setError("محله ملک را انتخاب کنید.");
      return;
    }
    const areaNumber = Number(digits(area).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(areaNumber) || areaNumber <= 0 || areaNumber > 100000) {
      setError("متراژ ملک را به‌صورت معتبر وارد کنید.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const details = [
        "ثبت اولیه ملک توسط مالک",
        `نوع معامله: ${deal}`,
        `نوع ملک: ${propertyType}`,
        `محله: ${neighborhood}`,
        `متراژ: ${areaNumber.toLocaleString("fa-IR")} متر`,
        bedrooms ? `خواب: ${bedrooms}` : "",
        price ? `قیمت کل: ${formatToman(parseAmount(price))} تومان` : "",
        deposit ? `رهن: ${formatToman(parseAmount(deposit))} تومان` : "",
        rent ? `اجاره: ${formatToman(parseAmount(rent))} تومان` : "",
        description.trim() ? `توضیحات مالک: ${description.trim()}` : "",
      ].filter(Boolean).join("\n");

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizedPhone,
          peopleCount: 1,
          job: "مالک",
          deal: `ثبت ملک - ${deal}`,
          propertyType,
          neighborhood,
          floorPreference: "",
          requestedBedrooms: bedrooms ? Number(digits(bedrooms)) : undefined,
          requestedAmenities: [],
          consultant: "",
          note: details,
          source: "website",
          matches: [],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.statusMessage || payload?.message || "ثبت ملک انجام نشد.");
      }
      setDone(payload.trackingToken || "");
      toast.success("اطلاعات ملک برای کارشناسان هیرمند ارسال شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت ملک انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="owner-submit-page">
      <header className="owner-submit-header">
        <Link to="/" className="owner-back">بازگشت به هیرمند</Link>
        <div className="owner-brand">
          <span className="owner-icon"><Home size={22} /></span>
          <span>
            <small>HIRMAND REAL ESTATE</small>
            <strong>ثبت ملک توسط مالک</strong>
          </span>
        </div>
      </header>

      <section className="owner-submit-shell">
        <div className="owner-submit-intro">
          <span className="kicker">ثبت اولیه رایگان</span>
          <h1>ملکتان را برای فروش یا اجاره به هیرمند بسپارید.</h1>
          <p>
            مشخصات اولیه را وارد کنید؛ تیم هیرمند اطلاعات را بررسی می‌کند و برای تکمیل فایل و هماهنگی با شما تماس می‌گیرد.
          </p>
          <div className="owner-benefits">
            <div><CheckCircle2 size={18} /> بررسی اولیه مشخصات</div>
            <div><CheckCircle2 size={18} /> هماهنگی مستقیم با مالک</div>
            <div><CheckCircle2 size={18} /> کد رهگیری برای پیگیری</div>
          </div>
          <a className="owner-direct-call" href={`tel:${SITE.phone.office}`}>
            <Phone size={17} />
            تماس با دفتر هیرمند
          </a>
        </div>

        {done ? (
          <section className="owner-success">
            <div className="owner-success-icon"><CheckCircle2 size={28} /></div>
            <span className="kicker">ثبت شد</span>
            <h2>اطلاعات اولیه ملک دریافت شد.</h2>
            <p>کارشناس هیرمند برای تکمیل اطلاعات و هماهنگی انتشار فایل با شما تماس می‌گیرد.</p>
            {done ? (
              <div className="owner-tracking">
                <small>کد رهگیری</small>
                <strong dir="ltr">{done}</strong>
                <a className="btn-gold" href={`/request-tracking?code=${encodeURIComponent(done)}`}>
                  <Send size={16} /> پیگیری درخواست
                </a>
              </div>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => { setDone(""); setError(""); }}>
              ثبت یک ملک دیگر
            </button>
          </section>
        ) : (
          <form className="owner-form" onSubmit={submit}>
            <div className="owner-form-grid">
              <label className="field"><span>نام مالک</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="field"><span>شماره موبایل</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="0912..." /></label>
              <label className="field"><span>نوع معامله</span><select value={deal} onChange={(e) => setDeal(e.target.value)}>{SERVICES.map((item) => <option key={item.id}>{item.title}</option>)}</select></label>
              <label className="field"><span>نوع ملک</span><select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>{PROPERTY_TYPES.map((item) => <option key={item.id}>{item.title}</option>)}</select></label>
              <label className="field"><span>محله</span><select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}><option value="">انتخاب محله</option>{NEIGHBORHOODS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
              <label className="field"><span>متراژ</span><input value={area} onChange={(e) => setArea(e.target.value)} inputMode="decimal" dir="ltr" placeholder="مثلاً 120" /></label>
              <label className="field"><span>تعداد خواب</span><select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}><option value="">فرقی ندارد</option>{[0,1,2,3,4,5].map((n) => <option key={n} value={String(n)}>{n === 0 ? "بدون خواب" : n.toLocaleString("fa-IR") + " خواب"}</option>)}</select></label>
              {deal === "خرید" || deal === "فروش" ? (
                <label className="field"><span>{deal === "فروش" ? "قیمت موردنظر" : "قیمت اعلامی"} (تومان)</span><input value={price} onChange={(e) => setPrice(formatMoney(e.target.value))} inputMode="numeric" dir="ltr" placeholder="مثلاً 5,000,000,000" /></label>
              ) : null}
              {deal === "رهن" || deal === "اجاره" ? (
                <>
                  <label className="field"><span>رهن (تومان)</span><input value={deposit} onChange={(e) => setDeposit(formatMoney(e.target.value))} inputMode="numeric" dir="ltr" /></label>
                  <label className="field"><span>اجاره ماهانه (تومان)</span><input value={rent} onChange={(e) => setRent(formatMoney(e.target.value))} inputMode="numeric" dir="ltr" /></label>
                </>
              ) : null}
              <label className="field owner-full"><span>توضیحات ملک</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="مثلاً پارکینگ، آسانسور، طبقه، وضعیت سند، شرایط فروش یا اجاره..." /></label>
            </div>
            {error ? <p className="owner-error" role="alert">{error}</p> : null}
            <div className="owner-form-actions">
              <Link to="/" className="btn-ghost">انصراف</Link>
              <button type="submit" className="btn-gold" disabled={busy}>
                <FilePlus2 size={18} />
                {busy ? "در حال ارسال..." : "ثبت اطلاعات ملک"}
              </button>
            </div>
            <p className="owner-note">ثبت این فرم به‌معنی انتشار خودکار آگهی نیست؛ اطلاعات ابتدا توسط کارشناسان هیرمند بررسی و تکمیل می‌شود.</p>
          </form>
        )}
      </section>
    </main>
  );
}
