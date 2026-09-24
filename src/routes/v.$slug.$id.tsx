import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublishedProperty, getPublishedPropertyById } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";

export const Route = createFileRoute("/v/$slug/$id")({
  loader: async ({ params }) => {
    try {
      // Legacy URLs have appeared in both /v/<slug>/<id> and /v/<anything>/<slug>
      // forms over time. Resolve the stable id first, then fall back to the slug
      // so old shared links do not silently become 404s.
      const property =
        (await getPublishedPropertyById({ data: { id: params.id } }).catch(() => null)) ??
        (await getPublishedProperty({ data: { slug: params.slug } }).catch(() => null));
      if (!property) throw notFound();

      throw redirect({
        to: "/properties/$slug",
        params: { slug: property.slug },
        replace: true,
      });
    } catch (error) {
      if (error && typeof error === "object" && "isRedirect" in error) {
        throw error;
      }
      console.error("[property-detail] v route loader failed", error);
      throw notFound();
    }
  },
  head: ({ params }) => propertyHead(null, params.slug),
  component: LegacyVPropertyRoutePage,
});

function LegacyVPropertyRoutePage() {
  return null;
}
