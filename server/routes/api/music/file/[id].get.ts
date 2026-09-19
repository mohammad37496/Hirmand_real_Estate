import { get as getBlob } from "@vercel/blob";
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
          return "https://" + storeId + ".public.blob.vercel-storage.com" + parsed.pathname;
        }
      }
    }
    return raw;
  } catch {
    return raw;
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")?.trim();
  if (!id) throw createError({ statusCode: 400, statusMessage: "شناسه آهنگ نامعتبر است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select url, mime_type from music_tracks where id = $1 and active = true limit 1",
    [id],
  );
  const row = rows[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });
  const target = normalizeBlobUrl(String(row.url));
  const range = event.req.headers.get("range");

  try {
    const blob = await getBlob(target, {
      access: "public",
      headers: range ? { range } : undefined,
    });

    if (!blob) {
      throw createError({
        statusCode: 404,
        statusMessage: "فایل موسیقی پیدا نشد.",
      });
    }

    const headers = new Headers();
    headers.set(
      "content-type",
      String(row.mime_type || blob.blob.contentType || "audio/mpeg"),
    );
    headers.set("content-disposition", "inline");
    headers.set("accept-ranges", blob.headers.get("accept-ranges") || "bytes");

    for (const name of [
      "content-length",
      "content-range",
      "etag",
      "cache-control",
      "last-modified",
      "accept-ranges",
    ]) {
      const value = blob.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(blob.stream, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error("[music-stream] blob read failed", error);
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 502,
      statusMessage: "فایل موسیقی از فضای ذخیره‌سازی قابل دریافت نیست.",
    });
  }
});