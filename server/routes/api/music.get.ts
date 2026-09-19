import { defineEventHandler } from "h3";
import { dbSource, getSql } from "@/lib/db";

function normalizeBlobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const delegation = url.searchParams.get("vercel-blob-delegation");
    if (!delegation) return raw;
    const dot = delegation.indexOf(".");
    if (dot <= 0) return raw;
    const payload = JSON.parse(
      Buffer.from(delegation.slice(0, dot), "base64url").toString("utf8"),
    ) as { storeId?: unknown };
    if (typeof payload.storeId !== "string" || !payload.storeId) return raw;
    const storeId = payload.storeId.startsWith("store_")
      ? payload.storeId.slice("store_".length)
      : payload.storeId;
    return "https://" + storeId + ".public.blob.vercel-storage.com" + url.pathname;
  } catch {
    return raw;
  }
}

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
      src: normalizeBlobUrl(String(row.url)),
      position: Number(row.position) || 0,
    })),
  };
});