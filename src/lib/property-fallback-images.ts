import type { PropertyType } from "@/lib/properties";

type FallbackMap = Record<PropertyType, readonly string[]>;

/**
 * Realistic photographic fallbacks for listings without uploaded media.
 *
 * The set is intentionally cohesive with Hirmand's canonical navy / brass /
 * paper visual system: warm neutrals, natural wood, soft daylight and restrained
 * blue/green accents. Images are free-to-use Unsplash photos and are delivered
 * through the image CDN at a bounded width.
 */
export const PROPERTY_FALLBACK_IMAGES: FallbackMap = {
  apartment: [
    "https://images.unsplash.com/photo-1781344334903-f33d8b76e292?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1771888703723-01d85da1dae1?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1774429076579-d90d43bffd3b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1766245456897-5c86726d084d?auto=format&fit=crop&fm=jpg&q=84&w=1600",
  ],
  villa: [
    "https://images.unsplash.com/photo-1771371428960-35a50c2d4e7c?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783125127024-3f3eda015db4?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786204685672-e344095e5b49?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783125127199-860da9744dcc?auto=format&fit=crop&fm=jpg&q=84&w=1600",
  ],
  office: [
    "https://images.unsplash.com/photo-1774953037913-af0cf688491a?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1767786330387-5cef0327b6c1?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1765371512971-9d4da531d004?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1782080163196-26ed8ea266d7?auto=format&fit=crop&fm=jpg&q=84&w=1600",
  ],
  heritage: [
    "https://images.unsplash.com/photo-1780245989984-a178d6c54a7b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1782414720823-5966c6c24446?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783195269540-37d9a87b270b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783066232761-b68438c0d9a6?auto=format&fit=crop&fm=jpg&q=84&w=1600",
  ],
  land: [
    "https://images.unsplash.com/photo-1781816927578-ec36210fede0?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783066232761-b68438c0d9a6?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783125127199-860da9744dcc?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1769780265587-037ee842c0b0?auto=format&fit=crop&fm=jpg&q=84&w=1600",
  ],
  commercial: [
    "https://images.unsplash.com/photo-1778034758869-75d25cd6e737?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786114604377-43f9636c3414?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786456629213-d087d121044f?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1778069982088-eb6605730a30?auto=format&fit=crop&fm=jpg&q=84&w=1600",
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
