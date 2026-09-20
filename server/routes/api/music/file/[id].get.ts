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

  const range = event.req.headers.get("range");
  let upstream: Response;

  try {
    upstream = await fetch(target, {
      method: event.req.method === "HEAD" ? "HEAD" : "GET",
      headers: range ? { range } : undefined,
    });
  } catch (error) {
    console.error("[music-file] blob fetch failed", error);
    throw createError({
      statusCode: 502,
      statusMessage: "فایل موسیقی از فضای ذخیره‌سازی قابل دریافت نیست.",
    });
  }

  if (!upstream.ok && upstream.status !== 206) {
    console.error("[music-file] blob response failed", upstream.status, target);
    throw createError({
      statusCode: upstream.status === 404 ? 404 : 502,
      statusMessage: upstream.status === 404
        ? "فایل موسیقی پیدا نشد."
        : "فایل موسیقی از فضای ذخیره‌سازی قابل دریافت نیست.",
    });
  }

  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set(
    "cache-control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );
  headers.set("content-disposition", "inline");

  return new Response(
    event.req.method === "HEAD" ? null : upstream.body,
    {
      status: upstream.status,
      headers,
    },
  );
});
