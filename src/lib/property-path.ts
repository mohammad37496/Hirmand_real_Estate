import type { PropertyCardData } from "@/lib/properties";

export function propertyPath(property: Pick<PropertyCardData, "id" | "slug">): string {
  const slug = encodeURIComponent(property.slug.trim());
  return `/properties/${slug}`;
}
