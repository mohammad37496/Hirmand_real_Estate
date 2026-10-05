import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminPhoneBridge } from "@/components/hirmand/admin-phone-bridge";
import "@/admin-phone-bridge.css";

export const Route = createFileRoute("/admin-phone-bridge")({
  component: AdminPhoneBridge,
  head: () => ({
    meta: [
      { title: `اتصال گوشی و همگام‌سازی | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
