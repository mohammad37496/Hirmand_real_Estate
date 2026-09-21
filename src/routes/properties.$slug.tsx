import { createFileRoute } from "@tanstack/react-router";
import { getPublishedProperty, listRelatedProperties } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";
import { PropertyDetailView } from "@/components/hirmand/property-detail-view";

export const Route = createFileRoute("/properties/$slug")({
  loader: async ({ params }) => {
    const property = await getPublishedProperty({ data: { slug: params.slug } });
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
  },
  head: ({ loaderData, params }) =>
    propertyHead(loaderData?.property ?? null, params.slug),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const data = Route.useLoaderData();
  return <PropertyDetailView property={data.property} related={data.related} />;
}
