import { createFileRoute } from "@tanstack/react-router";
import { getPublishedProperty, listRelatedProperties } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";
import { PropertyDetailView } from "@/components/hirmand/property-detail-view";

export const Route = createFileRoute("/v/$slug/$id")({
  loader: async ({ params }) => {
    try {
      // The UUID/id is stable; the title slug is only for readability.
      const property = await getPublishedProperty({ data: { slug: params.id } });
      if (!property) return { property: null, related: [] };

      const related = await listRelatedProperties({
        data: {
          slug: property.slug,
          neighborhood: property.neighborhood,
          propertyType: property.propertyType,
          limit: 6,
        },
      });

      return { property, related };
    } catch (error) {
      console.error("[property-detail] v route loader failed", error);
      return { property: null, related: [] };
    }
  },
  head: ({ loaderData, params }) =>
    propertyHead(loaderData?.property ?? null, params.slug + "/" + params.id),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const data = Route.useLoaderData();
  return <PropertyDetailView property={data.property} related={data.related} />;
}
