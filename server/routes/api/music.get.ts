import { defineEventHandler, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";

function normalizeBlobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const delegation = url.searchParams.get("vercel-blob-delegation");

    if (!delegation) {
      if (
        url.hostname === "blob.vercel-storage.com" ||
        url.hostname.endsWith(".private.blob.vercel-storage.com")
      ) {
        const storeId = getConfiguredBlobStoreId();
        if (storeId) {
          return `https://${storeId}.public.blob.vercel-storage.com${url.pathname}`;
        }
      }

      if (url.hostname.endsWith(".public.blob.vercel-storage.com")) {
        url.search = "";
        url.hash = "";
        return url.toString();
      }

      return raw;
    }

    const dot = delegation.indexOf(".");
    if (dot <= 0) return raw;

    const payload = JSON.parse(
      Buffer.from(delegation.slice(0, dot), "base64url").toString("utf8"),
    ) as { storeId?: unknown };

    if (typeof payload.storeId !== "string" || !payload.storeId) return raw;

    const storeId = payload.storeId.startsWith("store_")
      ? payload.storeId.slice("store_".length)
      : payload.storeId;

    return `https://${storeId}.public.blob.vercel-storage.com${url.pathname}`;
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
  setResponseHeader(event, "cache-control", "no-store");
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
      stream: `/api/music/file/${encodeURIComponent(String(row.id))}`,
      position: Number(row.position) || 0,
    })),
  };
});