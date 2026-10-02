import { useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Send } from "lucide-react";
import type { Property } from "@/lib/properties";
import { formatToman } from "@/lib/money";
import { SITE } from "@/lib/site";
import { toast } from "sonner";
import "@/property-deal-execution.css";

function amount(value: string | null | undefined) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function PropertyOfferMessage({ property }: { property: Property }) {
  const price = amount(property.price);
  const [discountPercent, setDiscountPercent] = useState(5);
  const [conditions, setConditions] = useState("بازدید و بررسی مدارک ملک، سپس توافق نهایی.");
  const [copied, setCopied] = useState(false);

  const offer = Math.max(0, Math.round(price * (1 - discountPercent / 100)));

  const message = useMemo(() => {
    if (!price) return "";
    return [
      `سلام، درباره فایل «${property.title}» از سایت هیرمند پیام می‌دهم.`,
      `قیمت اعلامی: ${formatToman(price)} تومان`,
      `پیشنهاد من: ${formatToman(offer)} تومان (${discountPercent.toLocaleString("fa-IR")}% پایین‌تر از قیمت اعلامی)`,
      conditions.trim() ? `شرایط پیشنهادی: ${conditions.trim()}` : "",
      "در صورت قابل‌بررسی بودن، لطفاً امکان مذاکره و زمان مناسب تماس/بازدید را اعلام بفرمایید.",
    ].filter(Boolean).join("\n");
  }, [conditions, discountPercent, offer, price, property.title]);

  async function copyMessage() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("متن پیشنهاد کپی شد.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("کپی متن انجام نشد.");
    }
  }

  function openWhatsApp() {
    if (!message) return;
    window.open(`${SITE.whatsappDirect}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="property-deal-tool" aria-labelledby="property-offer-message-title">
      <header className="property-deal-tool-head">
        <div>
          <span className="kicker">مذاکره آماده ارسال</span>
          <h2 id="property-offer-message-title"><MessageCircle size={20} /> پیام پیشنهادی برای مذاکره</h2>
          <p>یک متن آماده بر اساس سناریوی شما می‌سازیم؛ این متن فقط پیشنهاد شخصی شماست و وعده تخفیف از طرف مالک نیست.</p>
        </div>
      </header>
      {price > 0 ? (
        <div className="property-deal-grid">
          <div className="property-deal-controls">
            <label className="property-deal-field">
              <span>تخفیف هدف: {discountPercent.toLocaleString("fa-IR")}٪</span>
              <input type="range" min="0" max="20" step="1" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
            </label>
            <div className="property-deal-summary">
              <span>قیمت پیشنهادی</span>
              <strong>{formatToman(offer)} تومان</strong>
            </div>
            <label className="property-deal-field">
              <span>شرایط پیشنهادی</span>
              <textarea maxLength={280} rows={4} value={conditions} onChange={(e) => setConditions(e.target.value)} />
            </label>
          </div>
          <div className="property-offer-preview">
            <div className="property-offer-preview-head"><span>پیش‌نمایش پیام</span><b>{message.length.toLocaleString("fa-IR")} کاراکتر</b></div>
            <pre>{message}</pre>
            <div className="property-deal-actions">
              <button type="button" className="property-deal-btn" onClick={() => void copyMessage()}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "کپی شد" : "کپی متن"}
              </button>
              <button type="button" className="property-deal-btn property-deal-btn-primary" onClick={openWhatsApp}>
                <Send size={16} /> ارسال در واتساپ
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="property-deal-empty">برای ساخت پیام پیشنهادی، قیمت فروش عددی این فایل باید ثبت شده باشد.</p>
      )}
    </section>
  );
}
