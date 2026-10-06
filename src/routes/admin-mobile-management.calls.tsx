import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminMobileStaffCallsPage } from "@/components/hirmand/admin-mobile-staff-calls";

export const Route = createFileRoute("/admin-mobile-management/calls")({
  component: AdminMobileStaffCallsPage,
  head: () => ({
    meta: [
      { title: `تماس‌های کارکنان | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
