import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE } from "@/lib/site";
import { AdminPropertiesPage } from "@/components/hirmand/admin-properties-page";
import "@/admin-phone-bridge.css";

function AdminPage() {
  return (
    <>
      <AdminPropertiesPage />
      <Link to="/admin-phone-bridge" className="pb-admin-shortcut">
        <span aria-hidden="true">▣</span>
        مدیریت اتصال گوشی
      </Link>
    </>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: `مدیریت فایل‌ها | ${SITE.nameFa}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
