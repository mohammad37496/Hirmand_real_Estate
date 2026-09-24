import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedProperty, listRelatedProperties } from "@/lib/properties";
import { propertyHead } from "@/lib/seo";
import { PropertyDetailView } from "@/components/hirmand/property-detail-view";

export const Route = createFileRoute("/properties/$slug")({
  loader: async ({ params }) => {
    const property = await getPublishedProperty({ data: { slug: params.slug } });
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
    propertyHead(loaderData?.property ?? null, params.slug),
  pendingMs: 700,
  pendingMinMs: 400,
  pendingComponent: PropertyDetailPending,
  component: PropertyPropertiesPage,
});

function PropertyDetailPending() {
  return (
    <main
      className="property-detail-page property-detail-skeleton"
      aria-busy="true"
      aria-label="در حال بارگذاری فایل"
    >
      <div className="property-skeleton-breadcrumb" />
      <section className="property-detail-top" aria-hidden="true">
        <div className="property-skeleton-gallery" />
        <div className="property-skeleton-summary">
          <span className="property-skeleton-line property-skeleton-line-short" />
          <span className="property-skeleton-line property-skeleton-line-title" />
          <span className="property-skeleton-line property-skeleton-line-medium" />
          <div className="property-skeleton-price" />
          <div className="property-skeleton-actions" />
          <div className="property-skeleton-contact" />
        </div>
      </section>
      <section className="property-skeleton-section" aria-hidden="true">
        <span className="property-skeleton-line property-skeleton-line-medium" />
        <div className="property-skeleton-specs" />
        <span className="property-skeleton-line property-skeleton-line-long" />
        <span className="property-skeleton-line property-skeleton-line-long" />
      </section>
    </main>
  );
}

function PropertyPropertiesPage() {
  const data = Route.useLoaderData();
  return <PropertyDetailView property={data.property} related={data.related} />;
}
