import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedPropertyById, listRelatedProperties } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";
import { PropertyDetailView } from "@/components/hirmand/property-detail-view";

export const Route = createFileRoute("/file/$id")({
  loader: async ({ params }) => {
    const property = await getPublishedPropertyById({ data: { id: params.id } });
    if (!property) throw notFound();

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
    propertyHead(loaderData?.property ?? null, `file/${params.id}`),
  component: PropertyFilePage,
});

function PropertyFilePage() {
  const data = Route.useLoaderData();
  return <PropertyDetailView property={data.property} related={data.related} />;
}
