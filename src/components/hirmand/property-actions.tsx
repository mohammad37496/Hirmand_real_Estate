import { useEffect, useState, type MouseEvent } from "react";
import { ArrowLeftRight, Heart, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { PropertyCardData } from "@/lib/properties";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { propertyPath } from "@/lib/property-path";

const FAVORITES_KEY = "hirmand-favorite-properties";
const COMPARE_KEY = "hirmand-compare-properties";
const MAX_COMPARE = 3;

function readCompare(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

function toggleCompare(slug: string): { added: boolean; next: string[] } {
  const current = readCompare();
  if (current.includes(slug)) {
    const next = current.filter((item) => item !== slug);
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures in private browsing contexts.
    }
    return { added: false, next };
  }
  if (current.length >= MAX_COMPARE) return { added: false, next: current };
  const next = [...current, slug];
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures in private browsing contexts.
    return { added: false, next: current };
  }
  return { added: true, next };
}

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toggleFavorite(slug: string): boolean {
  const current = readFavorites();
  const exists = current.includes(slug);
  const next = exists
    ? current.filter((item) => item !== slug)
    : [...current, slug];

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next.slice(-100)));
  } catch {
    // Optional convenience feature; ignore storage failures.
  }

  return !exists;
}

async function shareProperty(property: Pick<PropertyCardData, "id" | "slug" | "title">) {
  const url = new URL(propertyPath(property), window.location.origin).toString();
  const shareData = {
    title: property.title,
    text: `فایل «${property.title}» در هیرمند`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success("لینک فایل کپی شد.");
    } else {
      toast.info(url);
      return;
    }

    trackAnalyticsEvent("property_share", property.slug);
  } catch {
    // User cancelled the native share sheet.
  }
}

export function PropertyActions({
  property,
  compact = false,
}: {
  property: Pick<PropertyCardData, "id" | "slug" | "title">;
  compact?: boolean;
}) {
  const [favorite, setFavorite] = useState(false);
  const [compared, setCompared] = useState(false);

  useEffect(() => {
    setFavorite(readFavorites().includes(property.slug));
    setCompared(readCompare().includes(property.slug));
  }, [property.slug]);

  function onFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleFavorite(property.slug);
    setFavorite(next);
    trackAnalyticsEvent("property_favorite", property.slug);
    toast.success(next ? "فایل در ذخیره‌ها قرار گرفت." : "فایل از ذخیره‌ها حذف شد.");
  }

  function onShare(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void shareProperty(property);
  }

  function onPrint(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => window.print(), 50);
  }

  function onCompare(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const current = readCompare();
    if (!compared && current.length >= MAX_COMPARE) {
      toast.info("برای مقایسه هم‌زمان حداکثر ۳ فایل انتخاب کنید.");
      return;
    }

    const result = toggleCompare(property.slug);
    setCompared(result.added);
    trackAnalyticsEvent("property_compare", property.slug);
    toast.success(
      result.added
        ? "فایل به مقایسه اضافه شد."
        : "فایل از مقایسه حذف شد.",
    );
  }


  return (
    <div className={`property-actions${compact ? " property-actions-compact" : ""}`}>
      <button
        type="button"
        className={`property-action${favorite ? " is-active" : ""}`}
        onClick={onFavorite}
        aria-label={favorite ? "حذف از ذخیره‌ها" : "ذخیره فایل"}
        aria-pressed={favorite}
        title={favorite ? "حذف از ذخیره‌ها" : "ذخیره فایل"}
      >
        <Heart size={compact ? 17 : 16} fill={favorite ? "currentColor" : "none"} />
        {!compact ? <span>{favorite ? "ذخیره‌شده" : "ذخیره فایل"}</span> : null}
      </button>
      <button
        type="button"
        className="property-action"
        onClick={onShare}
        aria-label="اشتراک‌گذاری فایل"
        title="اشتراک‌گذاری"
      >
        <Share2 size={compact ? 17 : 16} />
        {!compact ? <span>اشتراک‌گذاری</span> : null}
      </button>
      <button
        type="button"
        className="property-action"
        onClick={onPrint}
        aria-label="چاپ فایل"
        title="چاپ فایل"
      >
        <Printer size={compact ? 17 : 16} />
        {!compact ? <span>چاپ فایل</span> : null}
      </button>
      <button
        type="button"
        className={`property-action${compared ? " is-active" : ""}`}
        onClick={onCompare}
        aria-label={compared ? "حذف از مقایسه" : "افزودن به مقایسه"}
        aria-pressed={compared}
        title={compared ? "حذف از مقایسه" : "مقایسه فایل"}
      >
        <ArrowLeftRight size={compact ? 17 : 16} />
        {!compact ? <span>{compared ? "در مقایسه" : "مقایسه"}</span> : null}
      </button>
    </div>
  );
}
