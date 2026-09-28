import type { PropertyType } from "@/lib/properties";

type FallbackMap = Record<PropertyType, readonly string[]>;

/**
 * Self-hosted fallback photography.
 *
 * The binary WebP/AVIF assets are committed into public/images/fallback by the
 * fallback-asset GitHub Action. The browser never needs the external source
 * service at runtime.
 */
export const PROPERTY_FALLBACK_IMAGES: FallbackMap = {
  apartment: [
    "/images/fallback/apartment-01.webp",
    "/images/fallback/apartment-02.webp",
    "/images/fallback/apartment-03.webp",
    "/images/fallback/apartment-04.webp",
  ],
  villa: [
    "/images/fallback/villa-01.webp",
    "/images/fallback/villa-02.webp",
    "/images/fallback/villa-03.webp",
    "/images/fallback/villa-04.webp",
  ],
  office: [
    "/images/fallback/office-01.webp",
    "/images/fallback/office-02.webp",
    "/images/fallback/office-03.webp",
    "/images/fallback/office-04.webp",
  ],
  heritage: [
    "/images/fallback/heritage-01.webp",
    "/images/fallback/heritage-02.webp",
    "/images/fallback/heritage-03.webp",
    "/images/fallback/heritage-04.webp",
  ],
  land: [
    "/images/fallback/land-01.webp",
    "/images/fallback/land-02.webp",
    "/images/fallback/land-03.webp",
    "/images/fallback/land-04.webp",
  ],
  commercial: [
    "/images/fallback/commercial-01.webp",
    "/images/fallback/commercial-02.webp",
    "/images/fallback/commercial-03.webp",
    "/images/fallback/commercial-04.webp",
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

export function getPropertyFallbackImageAvif(propertyType: PropertyType, propertyId: string) {
  return getPropertyFallbackImage(propertyType, propertyId).replace(/\.webp$/i, ".avif");
}
