import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/hirmand/site-page";
import { JSON_LD } from "@/lib/site";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      <SitePage />
    </>
  );
}
