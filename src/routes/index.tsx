import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/hirmand/site-page";
import { listPublishedProperties } from "@/lib/properties";
import { FAQ_JSON_LD, JSON_LD, SITE } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: () => listPublishedProperties({ data: {} }),
  component: Home,
  head: () => ({
    meta: [
      { title: SITE.title },
      { name: "description", content: SITE.description },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "fa_IR" },
      { property: "og:site_name", content: SITE.nameFa },
      { property: "og:title", content: SITE.title },
      { property: "og:description", content: SITE.description },
      { property: "og:url", content: SITE.url },
      { property: "og:image", content: `${SITE.url}/og.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE.title },
      { name: "twitter:description", content: SITE.description },
      { name: "twitter:image", content: `${SITE.url}/og.jpg` },
    ],
    links: [{ rel: "canonical", href: SITE.url }],
  }),
});

function Home() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      <script type="application/ld+json">{JSON.stringify(FAQ_JSON_LD)}</script>
      <SitePage initialProperties={Route.useLoaderData()} />
    </>
  );
}
