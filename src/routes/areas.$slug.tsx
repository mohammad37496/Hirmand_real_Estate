import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPinned, Phone } from "lucide-react";
import { listPublishedProperties } from "@/lib/properties";
import { findAreaBySlug, areaHead, areaJsonLd, areaPath, allAreas } from "@/lib/areas";
import { breadcrumbJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { SiteChrome } from "@/components/hirmand/site-chrome";
import { PropertyCard } from "@/components/hirmand/property-showcase";

export const Route = createFileRoute("/areas/$slug")({
  loader: async ({ params }) => {
    const area = findAreaBySlug(params.slug);
    if (!area) return { area: null, properties: [] as Awaited<ReturnType<typeof listPublishedProperties>> };
    try {
      const properties = await listPublishedProperties({
        data: { neighborhood: area.name },
      });
      return { area, properties };
    } catch (error) {
      console.error("[area] properties loader failed", error);
      return { area, properties: [] };
    }
  },
  head: ({ loaderData, params }) => areaHead(loaderData?.area ?? null, params.slug),
  component: AreaPage,
});

function AreaPage() {
  const { area, properties } = Route.useLoaderData();

  if (!area) {
    return (
      <SiteChrome className="property-detail-shell">
        <section className="property-not-found">
          <MapPinned size={32} />
          <h1>این محله پیدا نشد</h1>
          <p>محله درخواستی در فهرست مناطق تحت پوشش هیرمند نیست.</p>
          <Link to="/" hash="areas" className="btn-gold">
            مشاهده محله‌ها
          </Link>
        </section>
      </SiteChrome>
    );
  }

  const crumbs = breadcrumbJsonLd([
    { name: "صفحه اصلی", path: "/" },
    { name: "محله‌ها", path: "/#areas" },
    { name: area.name, path: areaPath(area.slug) },
  ]);

  const nearby = allAreas()
    .filter((a) => a.groupTitle === area.groupTitle && a.slug !== area.slug)
    .slice(0, 8);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${area.lat},${area.lng}`;

  return (
    <SiteChrome className="property-detail-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(areaJsonLd(area)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <main className="property-detail">
        <nav
          aria-label="مسیر صفحه"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            fontSize: "0.82rem",
            color: "var(--subtle)",
          }}
        >
          <Link to="/" style={{ color: "var(--muted)" }}>
            صفحه اصلی
          </Link>
          <span>/</span>
          <Link to="/" hash="areas" style={{ color: "var(--muted)" }}>
            محله‌ها
          </Link>
          <span>/</span>
          <span>{area.name}</span>
        </nav>

        <div className="property-detail-top">
          <Link to="/" hash="areas" className="back-link">
            <ArrowRight size={17} /> همه محله‌ها
          </Link>
          <span className="property-detail-code">{area.groupTitle}</span>
        </div>

        <div className="property-detail-grid">
          <div className="property-detail-main">
            <div className="property-card-meta">
              <span>اصفهان</span>
              <span>{area.groupTitle}</span>
            </div>
            <h1>املاک {area.name}</h1>
            <p className="property-detail-description">
              خرید، فروش، رهن و اجاره ملک در محله <strong>{area.name}</strong> اصفهان با همراهی
              گروه مشاورین املاک هیرمند. فایل‌های به‌روز این محله را در همین صفحه ببینید یا برای
              مشاوره اختصاصی با دفتر تماس بگیرید.
            </p>

            <div className="property-address">
              <MapPinned size={20} />
              <div>
                <strong>موقعیت روی نقشه</strong>
                <p>
                  {area.name}، اصفهان — مختصات تقریبی {area.lat.toFixed(4)}، {area.lng.toFixed(4)}
                </p>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  باز کردن در گوگل‌مپ
                </a>
              </div>
            </div>

            <section style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: "1.15rem", marginBottom: 12 }}>
                فایل‌های فعال در {area.name}
              </h2>
              {properties.length ? (
                <div className="property-grid">
                  {properties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>
                  در حال حاضر فایل منتشرشده‌ای برای این محله ثبت نشده است. برای دریافت فایل‌های
                  مناسب {area.name} از فرم درخواست یا تماس با مشاوران استفاده کنید.
                </p>
              )}
            </section>

            {nearby.length ? (
              <section style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>محله‌های نزدیک در همین منطقه</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {nearby.map((n) => (
                    <Link
                      key={n.slug}
                      to="/areas/$slug"
                      params={{ slug: n.slug }}
                      className="btn-ghost"
                      style={{ fontSize: "0.85rem", padding: "8px 14px" }}
                    >
                      {n.name}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="property-detail-side">
            <div className="property-price-box">
              <span>منطقه</span>
              <strong>{area.name}</strong>
            </div>
            <div className="property-contact-box">
              <span className="kicker">مشاوره محلی</span>
              <h2>گروه مشاورین هیرمند</h2>
              <p>برای فایل‌های {area.name} و بازدید هماهنگ کنید.</p>
              <a href={`tel:${SITE.phone.mobile}`} className="btn-gold">
                <Phone size={17} /> تماس با دفتر
              </a>
              <Link to="/" hash="inquiry" className="btn-ghost">
                فرم درخواست فایل
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </SiteChrome>
  );
}
