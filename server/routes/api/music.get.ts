import { defineEventHandler } from "h3";
import { dbSource, getSql } from "@/lib/db";

export default defineEventHandler(async () => {
  if (dbSource === "unconfigured") return { autoplay: true, tracks: [] };
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, title, artist, url, position
     from music_tracks where active = true
     order by position asc, created_at asc`,
  );
  return {
    autoplay: true,
    tracks: rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      artist: String(row.artist ?? ""),
      src: `/api/music/file/${encodeURIComponent(String(row.id))}`,
      position: Number(row.position) || 0,
    })),
  };
});