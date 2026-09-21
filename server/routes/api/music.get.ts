import { defineEventHandler, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { normalizePublicBlobUrl } from "@/lib/blob-url";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") return { autoplay: false, tracks: [] };

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, title, artist, url, position
     from music_tracks where active = true
     order by position asc, created_at asc`,
  );

  return {
    autoplay: false,
    tracks: rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      artist: String(row.artist ?? ""),
      src: normalizePublicBlobUrl(String(row.url)),
      stream: `/api/music/file/${encodeURIComponent(String(row.id))}`,
      position: Number(row.position) || 0,
    })),
  };
});
