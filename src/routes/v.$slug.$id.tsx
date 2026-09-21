import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublishedProperty } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";

export const Route = createFileRoute("/v/$slug/$id")({
  loader: async ({ params }) => {
    try {
      // The UUID/id is stable; the title slug is only for readability.
      const property = await getPublishedProperty({ data: { slug: params.id } });
      if (!property) throw notFound();

      // Legacy /v/:slug/:id URLs go straight to the canonical property URL.
      // Avoid the old two-hop redirect through /properties/:slug.
      throw redirect({
        to: "/file/$id",
        params: { id: property.id },
        replace: true,
      });
    } catch (error) {
      // TanStack Router redirects are thrown values; let them propagate.
      if (error && typeof error === "object" && "isRedirect" in error) {
        throw error;
      }
      console.error("[property-detail] v route loader failed", error);
      throw notFound();
    }
  },
  head: ({ params }) => propertyHead(null, params.slug + "/" + params.id),
  // This route is a legacy redirect only; its loader always throws redirect/notFound.
  component: LegacyVPropertyRoutePage,
});

function LegacyVPropertyRoutePage() {
  return null;
}
