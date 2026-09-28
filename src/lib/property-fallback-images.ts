import type { PropertyType } from "@/lib/properties";

type FallbackMap = Record<PropertyType, readonly string[]>;

/**
 * Realistic photographic fallbacks for listings without uploaded media.
 *
 * The photos are served through Unsplash's image CDN with a bounded width so
 * fallback galleries stay visually rich without downloading the original
 * source dimensions.
 */
export const PROPERTY_FALLBACK_IMAGES: FallbackMap = {
  apartment: [
    "https://images.unsplash.com/photo-1778604263874-5d9f372e0434?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
  villa: [
    "https://images.unsplash.com/photo-1781269986378-a2f366df4d0f?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1638989795059-f4dba0a3f291?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
  office: [
    "https://images.unsplash.com/photo-1774953037913-af0cf688491a?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1765371512971-9d4da531d004?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
  heritage: [
    "https://images.unsplash.com/photo-1780245989984-a178d6c54a7b?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1638989795059-f4dba0a3f291?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
  land: [
    "https://images.unsplash.com/photo-1724863169421-4e495fd7100f?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1781816927578-ec36210fede0?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
  commercial: [
    "https://images.unsplash.com/photo-1770385605649-11de1a033064?auto=format&fit=crop&fm=jpg&q=82&w=1600",
    "https://images.unsplash.com/photo-1768758533474-5cd148638a98?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  ],
};

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % length;
}

export function getPropertyFallbackImages(propertyType: PropertyType) {
  return PROPERTY_FALLBACK_IMAGES[propertyType] ?? PROPERTY_FALLBACK_IMAGES.apartment;
}

export function getPropertyFallbackImage(propertyType: PropertyType, propertyId: string) {
  const images = getPropertyFallbackImages(propertyType);
  return images[stableIndex(propertyId || propertyType, images.length)] ?? images[0];
}
