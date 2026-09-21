import { createError, defineEventHandler, getRouterParam, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { isPublicBlobUrl, normalizePublicBlobUrl } from "@/lib/blob-url";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")?.trim();

  if (!id) throw createError({ statusCode: 400, statusMessage: "شناسه آهنگ نامعتبر است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select url from music_tracks where id = $1 and active = true limit 1",
    [id],
  );
  const row = rows[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });

  const target = normalizePublicBlobUrl(String(row.url));
  if (!isPublicBlobUrl(target)) {
    throw createError({
      statusCode: 502,
      statusMessage: "فایل موسیقی روی Public Blob قابل پخش نیست.",
    });
  }

  setResponseHeader(event, "cache-control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  setResponseHeader(event, "content-disposition", "inline");

  return new Response(null, {
    status: 307,
    headers: { location: target },
  });
});
