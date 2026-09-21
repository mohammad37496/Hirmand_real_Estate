import type { PropertyCardData } from "@/lib/properties";

export function propertyPath(property: Pick<PropertyCardData, "id" | "slug">): string {
  const source = property.slug.trim() || property.id;
  const slug = encodeURIComponent(source);
  return `/properties/${slug}`;
}
