import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminPropertiesPage } from "@/components/hirmand/admin-properties-page";

export const Route = createFileRoute("/admin")({
  component: AdminPropertiesPage,
  head: () => ({
    meta: [
      { title: `مدیریت فایل‌ها | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
