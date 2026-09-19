import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/hirmand/site-page";
import { listPublishedProperties } from "@/lib/properties";
import { FAQ_JSON_LD } from "@/lib/site";
import { enhancedOrganizationJsonLd, homeHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: () => listPublishedProperties({ data: {} }),
  component: Home,
  head: () => homeHead(),
});

function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enhancedOrganizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <SitePage initialProperties={Route.useLoaderData()} />
    </>
  );
}
