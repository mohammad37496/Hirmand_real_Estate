import type { PropertyCardData } from "@/lib/properties";

export function propertyPath(property: Pick<PropertyCardData, "id" | "slug">): string {
  return "/v/" + encodeURIComponent(property.slug.trim()) + "/" + encodeURIComponent(property.id.trim());
}
