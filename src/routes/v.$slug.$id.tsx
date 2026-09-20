import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublishedProperty } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";
import { PropertyDetailView } from "@/components/hirmand/property-detail-view";

export const Route = createFileRoute("/v/$slug/$id")({
  loader: async ({ params }) => {
    try {
      // The UUID/id is stable; the title slug is only for readability.
      const property = await getPublishedProperty({ data: { slug: params.id } });
      if (!property) return { property: null };

      // Legacy /v/:slug/:id URLs are permanently consolidated into the canonical property URL.
      throw redirect({
        to: "/properties/$slug",
        params: { slug: property.slug },
        replace: true,
      });
    } catch (error) {
      // TanStack Router redirects are thrown values; let them propagate.
      if (error && typeof error === "object" && "isRedirect" in error) {
        throw error;
      }
      console.error("[property-detail] v route loader failed", error);
      return { property: null };
    }
  },
  head: ({ loaderData, params }) =>
    propertyHead(loaderData?.property ?? null, params.slug + "/" + params.id),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const data = Route.useLoaderData();
  return <PropertyDetailView property={data.property} related={[]} />;
}
