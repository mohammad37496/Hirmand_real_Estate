import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublishedProperty } from "@/lib/properties";

export const Route = createFileRoute("/v/$slug/$id")({
  loader: async ({ params }) => {
    try {
      const property =
        (await getPublishedProperty({ data: { slug: params.slug } })) ??
        (await getPublishedProperty({ data: { slug: params.id } }));
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
  head: () => ({ title: "انتقال فایل | هیرمند", meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: LegacyVPropertyRoutePage,
});

function LegacyVPropertyRoutePage() {
  return null;
}
