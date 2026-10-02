import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/hirmand/site-page";
import { FAQ_JSON_LD } from "@/lib/site";
import { enhancedOrganizationJsonLd, homeHead } from "@/lib/seo";
import { getPublicSiteSettings } from "@/lib/site-settings";

// The marketing shell must render even when the optional property database is
// unavailable. Listings hydrate client-side after the first paint.
export const Route = createFileRoute("/")({
  loader: async () => ({ settings: await getPublicSiteSettings() }),
  component: Home,
  head: ({ loaderData }) => homeHead(loaderData?.settings),
});

function Home() {
  const { settings } = Route.useLoaderData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enhancedOrganizationJsonLd(settings)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <SitePage initialProperties={[]} announcement={settings.announcementEnabled ? settings.announcementText : ""} />
    </>
  );
}
