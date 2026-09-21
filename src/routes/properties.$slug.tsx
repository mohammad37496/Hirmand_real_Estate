import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { getPublishedProperty } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";

export const Route = createFileRoute("/properties/$slug")({
  loader: async ({ params }) => {
    const property = await getPublishedProperty({ data: { slug: params.slug } });
    if (!property) throw notFound();
    throw redirect({ to: "/file/$id", params: { id: property.id }, replace: true });
  },
  head: ({ params }) => propertyHead(null, params.slug),
  component: LegacyPropertyRoutePage,
});

function LegacyPropertyRoutePage() {
  return null;
}
