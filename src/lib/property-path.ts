import type { PropertyCardData } from "@/lib/properties";

export function propertyPath(property: Pick<PropertyCardData, "id" | "slug">): string {
  const id = property.id.trim();
  return id ? `/file/${encodeURIComponent(id)}` : "/properties";
}
