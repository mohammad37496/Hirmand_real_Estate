import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminMobileCallsPage } from "@/components/hirmand/admin-mobile-calls";

export const Route = createFileRoute("/admin-mobile-management/calls")({
  component: AdminMobileCallsRoute,
  head: () => ({
    meta: [
      { title: `تماس‌ها — مدیریت تلفن همراه | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminMobileCallsRoute() {
  return <AdminMobileCallsPage />;
}
