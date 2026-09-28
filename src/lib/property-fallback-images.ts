import type { PropertyType } from "@/lib/properties";

type FallbackMap = Record<PropertyType, readonly string[]>;

/**
 * Guaranteed local fallback assets.
 *
 * These SVGs are already part of the repository, so they remain available
 * even when optional WebP/AVIF generation has not completed in CI.
 * The browser always gets a same-origin asset for properties without media.
 */
export const PROPERTY_FALLBACK_IMAGES: FallbackMap = {
  apartment: [
    "/images/fallback/apartment-01.svg",
    "/images/fallback/apartment-02.svg",
  ],
  villa: [
    "/images/fallback/villa-01.svg",
    "/images/fallback/villa-02.svg",
  ],
  office: [
    "/images/fallback/office-01.svg",
    "/images/fallback/office-02.svg",
  ],
  heritage: [
    "/images/fallback/heritage-01.svg",
    "/images/fallback/heritage-02.svg",
  ],
  land: [
    "/images/fallback/land-01.svg",
    "/images/fallback/land-02.svg",
  ],
  commercial: [
    "/images/fallback/commercial-01.svg",
    "/images/fallback/commercial-02.svg",
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
  const fallback = getPropertyFallbackImage(propertyType, propertyId);
  return /\.webp$/i.test(fallback) ? fallback.replace(/\.webp$/i, ".avif") : "";
}

export function getPropertyFallbackLegacyImage(propertyType: PropertyType, propertyId: string) {
  return getPropertyFallbackImage(propertyType, propertyId);
}
