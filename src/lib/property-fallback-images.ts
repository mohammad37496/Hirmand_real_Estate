import type { PropertyType } from "@/lib/properties";

type FallbackMap = Record<PropertyType, readonly string[]>;

/**
 * Curated, self-hosted fallback photography.
 *
 * The JPG files are downloaded from the source manifest during the build and
 * are then served from the same origin. The existing SVG assets remain as a
 * zero-network emergency fallback if a photo cannot be prepared.
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

const LEGACY_FALLBACK_IMAGES: FallbackMap = {
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

const FALLBACK_PATH_RE =
  /^\/images\/fallback\/(?:apartment|villa|office|heritage|land|commercial)-\d+\.(?:svg|jpe?g|webp|avif)$/i;

export function isPropertyFallbackImage(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;

  try {
    const pathname = new URL(normalized, "https://hirmand.local").pathname;
    return FALLBACK_PATH_RE.test(pathname);
  } catch {
    return FALLBACK_PATH_RE.test(normalized);
  }
}

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
  const images = LEGACY_FALLBACK_IMAGES[propertyType] ?? LEGACY_FALLBACK_IMAGES.apartment;
  return images[stableIndex(propertyId || propertyType, images.length)] ?? images[0];
}
