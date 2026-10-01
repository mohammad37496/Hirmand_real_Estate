import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, LoaderCircle, X } from "lucide-react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { PropertyAvailabilityStatus } from "@/lib/properties";
import "@/property-viewing-request.css";

type PropertyViewingRequestProps = {
  property: {
    id: string;
    slug: string;
    title: string;
    neighborhood: string;
    availabilityStatus: PropertyAvailabilityStatus;
  };
};

const AVAILABILITY_LABEL: Record<PropertyAvailabilityStatus, string> = {
  available: "موجود",
  reserved: "رزرو موقت",
  sold: "فروخته‌شده",
  rented: "اجاره‌داده‌شده",
  unavailable: "فعلاً ناموجود",
};

const TIMES = Array.from({ length: 23 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}).filter((time) => time <= "20:00");

function faDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function todayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toIranIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:30`).toISOString();
}

type Slot = { time: string; available: boolean };

export function PropertyViewingRequest({ property }: PropertyViewingRequestProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [time, setTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const visitAllowed = property.availabilityStatus === "available" || property.availabilityStatus === "reserved";
  const minimumDate = useMemo(() => todayIsoDate(), []);

  const loadSlots = useCallback(async (selectedDate: string) => {
    if (!property.id || !selectedDate) return;
    setLoadingSlots(true);
    setError("");
    try {
      const query = new URLSearchParams({ propertyId: property.id, date: selectedDate });
      const response = await fetch("/api/visit-availability?" + query.toString(), {
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null) as { slots?: Slot[]; message?: string; statusMessage?: string } | null;
      if (!response.ok) throw new Error(data?.statusMessage || data?.message || "ساعت‌های بازدید بارگذاری نشدند.");
      const nextSlots = Array.isArray(data?.slots) ? data.slots : [];
      setSlots(nextSlots);
      const selected = nextSlots.find((slot) => slot.time === time);
      if (!selected?.available) {
        const first = nextSlots.find((slot) => slot.available);
        setTime(first?.time ?? "");
      }
    } catch (cause) {
      setSlots([]);
      setError(cause instanceof Error ? cause.message : "ساعت‌های بازدید بارگذاری نشدند.");
    } finally {
      setLoadingSlots(false);
    }
  }, [property.id, time]);

  useEffect(() => {
    if (!open || done) return;
    void loadSlots(date);
  }, [open, date, done, loadSlots]);

  function close() {
    if (busy) return;
    setOpen(false);
    setDone(false);
    setError("");
  }

  async function submit() {
    const normalizedPhone = faDigits(phone).replace(/\D/g, "");
    if (name.trim().length < 2) {
      setError("نام و نام خانوادگی را وارد کنید.");
      return;
    }
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل را به‌صورت ۰۹xxxxxxxxx وارد کنید.");
      return;
    }
    if (!date || !time) {
      setError("روز و ساعت بازدید را مشخص کنید.");
      return;
    }

    const selectedSlot = slots.find((slot) => slot.time === time);
    if (selectedSlot && !selectedSlot.available) {
      setError("این ساعت همین حالا رزرو شده است؛ یک زمان دیگر انتخاب کنید.");
      await loadSlots(date);
      return;
    }

    const preferredAt = toIranIso(date, time);
    if (new Date(preferredAt).getTime() < Date.now() + 30 * 60 * 1000) {
      setError("زمان انتخابی باید حداقل ۳۰ دقیقه از اکنون فاصله داشته باشد.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizedPhone,
          peopleCount: 1,
          job: "",
          deal: "بازدید",
          propertyType: "بازدید فایل",
          neighborhood: property.neighborhood,
          floorPreference: "",
          requestedBedrooms: undefined,
          requestedAmenities: [],
          consultant: "",
          note: note.trim(),
          source: "website",
          propertyId: property.id,
          visitPreferredAt: preferredAt,
          matches: [],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        if (response.status === 409) await loadSlots(date);
        throw new Error(payload?.statusMessage || payload?.message || "ثبت درخواست بازدید انجام نشد.");
      }
      setDone(true);
      trackAnalyticsEvent("visit_request", property.slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت درخواست بازدید انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  const availableCount = slots.filter((slot) => slot.available).length;

  return (
    <>
      <button
        type="button"
        className="btn-gold property-viewing-trigger"
        disabled={!visitAllowed}
        onClick={() => {
          setOpen(true);
          setError("");
          setDone(false);
          setDate((current) => current || todayIsoDate());
          setTime((current) => current || "17:00");
          trackAnalyticsEvent("visit_request_click", property.slug);
        }}
      >
        <CalendarDays size={17} aria-hidden="true" />
        {visitAllowed ? "رزرو بازدید" : AVAILABILITY_LABEL[property.availabilityStatus]}
      </button>

      {open ? (
        <div className="property-viewing-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section className="property-viewing-modal" role="dialog" aria-modal="true" aria-labelledby="property-viewing-title">
            <button type="button" className="property-viewing-close" onClick={close} aria-label="بستن">
              <X size={19} />
            </button>

            {done ? (
              <div className="property-viewing-success">
                <div className="property-viewing-success-icon"><Check size={25} /></div>
                <span className="kicker">درخواست ثبت شد</span>
                <h2>درخواست بازدید شما دریافت شد.</h2>
                <p>زمان پیشنهادی شما ثبت شد. مشاور هیرمند برای هماهنگی نهایی با شما تماس می‌گیرد.</p>
                <div className="property-viewing-summary">
                  <strong>{property.title}</strong>
                  <span><CalendarDays size={15} /> {date}</span>
                  <span><Clock3 size={15} /> {time}</span>
                </div>
                <button type="button" className="btn-gold" onClick={close}>متوجه شدم</button>
              </div>
            ) : (
              <>
                <div className="property-viewing-head">
                  <span className="kicker">هماهنگی بازدید</span>
                  <h2 id="property-viewing-title">برای این فایل زمان مناسب انتخاب کنید.</h2>
                  <p>فایل «{property.title}» · {property.neighborhood}</p>
                </div>

                <div className="property-viewing-grid">
                  <label className="field">
                    <span>نام و نام خانوادگی</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </label>
                  <label className="field">
                    <span>شماره موبایل</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" autoComplete="tel" placeholder="0912..." />
                  </label>
                  <label className="field">
                    <span>روز پیشنهادی</span>
                    <input type="date" value={date} min={minimumDate} onChange={(e) => setDate(e.target.value)} dir="ltr" />
                  </label>

                  <div className="field property-viewing-time-field">
                    <span>ساعت‌های آزاد بازدید</span>
                    <div className="property-viewing-slot-meta">
                      <small>{loadingSlots ? "در حال بررسی ظرفیت…" : `${availableCount.toLocaleString("fa-IR")} زمان آزاد`}</small>
                      <small>مدت هر بازدید: حدود ۶۰ دقیقه</small>
                    </div>
                    <div className="property-viewing-slots" role="group" aria-label="ساعت‌های آزاد بازدید" aria-busy={loadingSlots}>
                      {TIMES.map((item) => {
                        const slot = slots.find((candidate) => candidate.time === item);
                        const available = slot ? slot.available : !loadingSlots;
                        const selected = time === item;
                        return (
                          <button
                            type="button"
                            key={item}
                            className={"property-viewing-slot" + (selected ? " is-selected" : "") + (!available ? " is-unavailable" : "")}
                            onClick={() => setTime(item)}
                            disabled={loadingSlots || !available}
                            aria-pressed={selected}
                          >
                            {loadingSlots ? <LoaderCircle size={13} className="property-viewing-slot-spin" aria-hidden="true" /> : null}
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="field property-viewing-note">
                    <span>توضیح کوتاه (اختیاری)</span>
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً بازدید دو نفره یا هماهنگی با مشاور..." />
                  </label>
                </div>

                {error ? <p className="property-viewing-error" role="alert">{error}</p> : null}

                <div className="property-viewing-actions">
                  <button type="button" className="btn-ghost" onClick={close} disabled={busy}>انصراف</button>
                  <button type="button" className="btn-gold" onClick={submit} disabled={busy || loadingSlots || !time}>
                    <CalendarDays size={17} />
                    {busy ? "در حال ثبت..." : "ثبت درخواست بازدید"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
