/**
 * Dynamic sitemap at /sitemap.xml
 * Includes: home, all neighborhood area pages, and published properties.
 */
import { defineEventHandler, setResponseHeader } from "h3";
import { allAreas, areaPath } from "../../src/lib/areas";
import { resolveDatabaseUrl } from "../../scripts/resolve-database-url.mjs";

const SITE = (process.env.VITE_SITE_URL || "https://www.hirmandrealestate.ir").replace(/\/$/, "");

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: string) {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lm}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function loadPropertyUrls(): Promise<{ loc: string; lastmod?: string }[]> {
  const databaseUrl = resolveDatabaseUrl().url;
  if (!databaseUrl) return [];

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 1, idleTimeoutMillis: 3000, connectionTimeoutMillis: 3000 });
    try {
      const res = await pool.query<{ id: string; slug: string; updated_at: Date | string | null }>(
        `select id, slug, updated_at from properties
         where status = 'published'
         order by published_at desc nulls last, created_at desc
         limit 49000`,
      );
      return res.rows.map((row) => {
        const lastmod =
          row.updated_at != null
            ? new Date(row.updated_at).toISOString().slice(0, 10)
            : undefined;
        return { loc: `${SITE}/v/${encodeURIComponent(String(row.slug))}/${encodeURIComponent(String(row.id))}`, lastmod };
      });
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch (err) {
    console.error("[sitemap] property query failed", err);
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const today = new Date().toISOString().slice(0, 10);
  const entries: string[] = [];

  entries.push(urlEntry(`${SITE}/`, "daily", "1.0", today));
  entries.push(urlEntry(`${SITE}/properties`, "daily", "0.9", today));

  for (const area of allAreas()) {
    entries.push(urlEntry(`${SITE}${areaPath(area.slug)}`, "weekly", "0.7", today));
  }

  const properties = await loadPropertyUrls();
  for (const item of properties) {
    entries.push(urlEntry(item.loc, "weekly", "0.8", item.lastmod ?? today));
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  setResponseHeader(event, "content-type", "application/xml; charset=utf-8");
  setResponseHeader(event, "cache-control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return body;
});
