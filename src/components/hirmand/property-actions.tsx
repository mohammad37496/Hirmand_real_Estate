import { useEffect, useState, type MouseEvent } from "react";
import { Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Property } from "@/lib/properties";
import { trackAnalyticsEvent } from "@/lib/analytics";

const FAVORITES_KEY = "hirmand-favorite-properties";

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

async function shareProperty(property: Property) {
  const url = new URL(
    `/properties/${property.slug}`,
    window.location.origin,
  ).toString();
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
  property: Property;
  compact?: boolean;
}) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(readFavorites().includes(property.slug));
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
    </div>
  );
}
