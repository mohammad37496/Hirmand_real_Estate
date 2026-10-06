import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminStaffOperationsPage } from "@/components/hirmand/admin-staff-operations";

export const Route = createFileRoute("/admin-mobile-management/operations")({
  component: AdminStaffOperationsPage,
  head: () => ({ meta: [
    { title: \`مرکز عملیات کارکنان | \${SITE.nameFa}\` },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});
