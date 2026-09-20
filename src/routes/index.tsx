import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/hirmand/site-page";
import { listPublishedPropertyCards } from "@/lib/properties";
import { FAQ_JSON_LD } from "@/lib/site";
import { enhancedOrganizationJsonLd, homeHead } from "@/lib/seo";

// Premium UI audit verified after the typecheck fixes.
// Production deploy trigger: keep Git/Vercel output synchronized.
export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await listPublishedPropertyCards({ data: {} });
    } catch (err) {
      console.error("[home] properties loader failed (check DATABASE_URL)", err);
      return [];
    }
  },
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
