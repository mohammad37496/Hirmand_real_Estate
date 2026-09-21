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

    if (
      parsed.hostname === "blob.vercel-storage.com" ||
      parsed.hostname.endsWith(".private.blob.vercel-storage.com")
    ) {
      const storeId = getConfiguredBlobStoreId();
      if (storeId) {
        return `https://${storeId}.public.blob.vercel-storage.com${parsed.pathname}`;
      }
    }

    if (parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
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

function isPublicBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
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

  if (!isPublicBlobUrl(target)) {
    throw createError({
      statusCode: 502,
      statusMessage: "نشانی فایل موسیقی عمومی و قابل پخش نیست.",
    });
  }

  // Do not proxy the audio body through a serverless function. Native audio
  // playback relies heavily on HTTP Range requests, and a redirect lets
  // Vercel Blob/CDN answer those requests directly and efficiently.
  return new Response(null, {
    status: 307,
    headers: {
      location: target,
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "content-disposition": "inline",
    },
  });
});
