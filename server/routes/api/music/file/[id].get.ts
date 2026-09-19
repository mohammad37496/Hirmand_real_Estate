import { createError, defineEventHandler, getRouterParam } from "h3";
import { dbSource, getSql } from "@/lib/db";

function normalizeBlobUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const delegation = parsed.searchParams.get("vercel-blob-delegation");
    if (delegation) {
      const dot = delegation.indexOf(".");
      if (dot > 0) {
        const payload = JSON.parse(
          Buffer.from(delegation.slice(0, dot), "base64url").toString("utf8"),
        ) as { storeId?: unknown };

        if (typeof payload.storeId === "string" && payload.storeId) {
          const storeId = payload.storeId.startsWith("store_")
            ? payload.storeId.slice("store_".length)
            : payload.storeId;

          return `https://${storeId}.public.blob.vercel-storage.com${parsed.pathname}`;
        }
      }
    }
    return raw;
  } catch {
    return raw;
  }
}
function getConfiguredBlobStoreId(): string | null {
  const raw = process.env.BLOB_STORE_ID?.trim();
  if (!raw) return null;
  return raw.startsWith("store_") ? raw.slice("store_".length) : raw;
}


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")?.trim();

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "شناسه آهنگ نامعتبر است.",
    });
  }

  if (dbSource === "unconfigured") {
    throw createError({
      statusCode: 404,
      statusMessage: "آهنگ پیدا نشد.",
    });
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select url from music_tracks where id = $1 and active = true limit 1",
    [id],
  );
  const row = rows[0];

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: "آهنگ پیدا نشد.",
    });
  }

  const target = normalizeBlobUrl(String(row.url));

  // The Blob is public, so redirect the browser to the canonical Blob URL.
  // This keeps native browser byte-range requests, seeking, caching and
  // media decoding intact instead of proxying the whole file through a
  // serverless function.
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(target);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "نشانی فایل موسیقی نامعتبر است.",
    });
  }

  if (parsedTarget.protocol !== "https:") {
    throw createError({
      statusCode: 502,
      statusMessage: "نشانی فایل موسیقی امن نیست.",
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: parsedTarget.toString(),
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
});
