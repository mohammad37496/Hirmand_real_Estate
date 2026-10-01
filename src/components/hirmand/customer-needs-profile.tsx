import { Check, Heart, LoaderCircle, Save, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NEIGHBORHOOD_NAMES, PROPERTY_TYPES, SERVICES } from "@/lib/site";
import { customerFetch } from "@/lib/customer-fetch";
import { formatToman } from "@/lib/money";
import "@/customer-needs-profile.css";

type Profile = {
  transactionType: string;
  propertyType: string;
  neighborhoods: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  bedrooms: number | null;
  requestedAmenities: string[];
  mustHaveAmenities: string[];
  updatedAt: string | null;
};

const AMENITIES = [
  ["parking", "پارکینگ"],
  ["elevator", "آسانسور"],
  ["storage", "انباری"],
  ["balcony", "بالکن/تراس"],
  ["master_bedroom", "خواب مستر"],
  ["yard", "حیاط"],
] as const;

const EMPTY: Profile = {
  transactionType: "",
  propertyType: "",
  neighborhoods: [],
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  bedrooms: null,
  requestedAmenities: [],
  mustHaveAmenities: [],
  updatedAt: null,
};

function moneyInput(value: number | null) {
  return value == null ? "" : value.toLocaleString("en-US");
}
function parseMoney(value: string) {
  const n = Number(value.replace(/[,،s]/g, "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function CustomerNeedsProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [neighborhoodText, setNeighborhoodText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void customerFetch("/api/customer-needs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "get" }),
    }).then(async r => {
      const data = await r.json().catch(() => null) as { profile?: Profile | null };
      if (r.ok && data?.profile) {
        setProfile(data.profile);
        setNeighborhoodText(data.profile.neighborhoods.join("، "));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggleAmenity(id: string, must = false) {
    setProfile(current => {
      const key = must ? "mustHaveAmenities" : "requestedAmenities";
      const currentValues = current[key];
      const next = currentValues.includes(id)
        ? currentValues.filter(item => item !== id)
        : [...currentValues, id];
      return { ...current, [key]: next };
    });
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError("");
    const neighborhoods = Array.from(new Set(
      neighborhoodText.split(/[،,]/).map(item => item.trim()).filter(Boolean),
    )).slice(0, 12);
    try {
      const response = await customerFetch("/api/customer-needs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          ...profile,
          neighborhoods,
          minPrice: profile.minPrice,
          maxPrice: profile.maxPrice,
          minArea: profile.minArea,
          maxArea: profile.maxArea,
        }),
      });
      const data = await response.json().catch(() => null) as { statusMessage?: string; profile?: Profile };
      if (!response.ok) throw new Error(data?.statusMessage || "پروفایل ذخیره نشد.");
      setProfile(data.profile ?? { ...profile, neighborhoods });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره پروفایل انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-needs-profile">
      <div className="customer-needs-head">
        <div>
          <span className="kicker"><Target size={13} /> پروفایل خرید</span>
          <h2>نیاز من به ملک</h2>
          <p>این مشخصات برای پیشنهادهای هوشمند و امتیاز تطابق فایل‌ها استفاده می‌شود.</p>
        </div>
        <Users size={23} />
      </div>
      {loading ? (
        <div className="customer-needs-loading"><LoaderCircle size={22} className="admin-spin" /> در حال بارگذاری…</div>
      ) : (
        <>
          <div className="customer-needs-grid">
            <label className="field"><span>نوع معامله</span><select value={profile.transactionType} onChange={e => setProfile(p => ({ ...p, transactionType: e.target.value }))}><option value="">فرقی ندارد</option>{SERVICES.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
            <label className="field"><span>نوع ملک</span><select value={profile.propertyType} onChange={e => setProfile(p => ({ ...p, propertyType: e.target.value }))}><option value="">فرقی ندارد</option>{PROPERTY_TYPES.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
            <label className="field customer-needs-wide"><span>محله‌های مورد علاقه</span><input value={neighborhoodText} onChange={e => setNeighborhoodText(e.target.value)} placeholder="مثلاً سپاهان‌شهر، مرداویج، چهارباغ" list="hirmand-neighborhoods" /><datalist id="hirmand-neighborhoods">{NEIGHBORHOOD_NAMES.map(x => <option key={x} value={x} />)}</datalist></label>
            <label className="field"><span>حداقل بودجه</span><input dir="ltr" inputMode="numeric" value={moneyInput(profile.minPrice)} onChange={e => setProfile(p => ({ ...p, minPrice: parseMoney(e.target.value) }))} placeholder="مثلاً ۳ میلیارد" /></label>
            <label className="field"><span>حداکثر بودجه</span><input dir="ltr" inputMode="numeric" value={moneyInput(profile.maxPrice)} onChange={e => setProfile(p => ({ ...p, maxPrice: parseMoney(e.target.value) }))} placeholder="مثلاً ۷ میلیارد" /></label>
            <label className="field"><span>حداقل متراژ</span><input dir="ltr" inputMode="numeric" value={profile.minArea ?? ""} onChange={e => setProfile(p => ({ ...p, minArea: e.target.value ? Number(e.target.value) : null }))} placeholder="مثلاً ۸۰" /></label>
            <label className="field"><span>حداکثر متراژ</span><input dir="ltr" inputMode="numeric" value={profile.maxArea ?? ""} onChange={e => setProfile(p => ({ ...p, maxArea: e.target.value ? Number(e.target.value) : null }))} placeholder="مثلاً ۱۵۰" /></label>
            <label className="field"><span>حداقل خواب</span><select value={profile.bedrooms ?? ""} onChange={e => setProfile(p => ({ ...p, bedrooms: e.target.value === "" ? null : Number(e.target.value) }))}><option value="">فرقی ندارد</option>{[1,2,3,4,5].map(x => <option key={x} value={x}>{x.toLocaleString("fa-IR")} خواب به بالا</option>)}</select></label>
          </div>

          <div className="customer-needs-amenities">
            <div><strong>امکانات مهم</strong><small>هرچه انتخاب بیشتری داشته باشید، پیشنهادها دقیق‌تر می‌شوند.</small></div>
            <div className="customer-needs-chip-row">
              {AMENITIES.map(([id, label]) => (
                <button key={id} type="button" className={profile.requestedAmenities.includes(id) ? "is-active" : ""} onClick={() => toggleAmenity(id)}>
                  {profile.requestedAmenities.includes(id) ? <Check size={13} /> : <Heart size={13} />}{label}
                </button>
              ))}
            </div>
            <div><strong>ضروری‌ها</strong><small>این موارد در امتیاز تطابق وزن بیشتری می‌گیرند.</small></div>
            <div className="customer-needs-chip-row">
              {AMENITIES.map(([id, label]) => (
                <button key={"must-"+id} type="button" className={profile.mustHaveAmenities.includes(id) ? "is-must" : ""} onClick={() => toggleAmenity(id, true)}>
                  {profile.mustHaveAmenities.includes(id) ? <Check size={13} /> : <Target size={13} />}{label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="customer-needs-error" role="alert">{error}</p> : null}
          <div className="customer-needs-actions">
            <span>{saved ? "پروفایل ذخیره شد؛ پیشنهادها به‌روزرسانی می‌شوند." : profile.updatedAt ? "آخرین تغییرات شما ذخیره شده است." : "پروفایل هنوز تکمیل نشده است."}</span>
            <button type="button" className="btn-gold" onClick={() => void save()} disabled={busy}><Save size={15} />{busy ? "در حال ذخیره…" : "ذخیره نیاز من"}</button>
          </div>
        </>
      )}
    </section>
  );
}