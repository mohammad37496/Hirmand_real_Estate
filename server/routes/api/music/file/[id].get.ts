import { createError, defineEventHandler, getRouterParam } from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  isPlayableMediaUrl,
  normalizeStoredMediaUrl,
} from "@/lib/music-library.server";

/**
 * Resolves a track id to its playable URL.
 *
 * Audio playback lives on HTTP range requests, so the response is a redirect
 * rather than a proxy: the CDN or our own `/api/media/<id>` endpoint answers the
 * range requests directly.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")?.trim();

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "شناسه آهنگ نامعتبر است." });
  }

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    "select url from music_tracks where id = $1 and active = true limit 1",
    [id],
  );
  const row = rows[0];

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "آهنگ پیدا نشد." });
  }

  const target = normalizeStoredMediaUrl(String(row.url));

  if (!isPlayableMediaUrl(target)) {
    throw createError({
      statusCode: 502,
      statusMessage: "نشانی فایل موسیقی قابل پخش نیست.",
    });
  }

  return new Response(null, {
    status: 307,
    headers: {
      location: target,
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "content-disposition": "inline",
    },
  });
});
