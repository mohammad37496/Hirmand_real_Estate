import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { del } from "@vercel/blob";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

type Action = "list" | "create" | "toggle" | "delete";
type Body = { action?: Action; id?: string; active?: boolean; title?: string; artist?: string; url?: string; mimeType?: string; sizeBytes?: number };
const ALLOWED_MUSIC_TYPES = new Set(["audio/mpeg","audio/mp3","audio/ogg","audio/wav","audio/x-wav","audio/mp4","audio/x-m4a","audio/aac"]);

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

function isPublicBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function getConfiguredBlobStoreId(): string | null {
  const raw = process.env.BLOB_STORE_ID?.trim();
  if (!raw) return null;
  return raw.startsWith("store_") ? raw.slice("store_".length) : raw;
}


export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = (await readBody(event)) as Body;

  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({
      statusCode: 401,
      statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید.",
    });
  }
  if (dbSource === "unconfigured") {
    if (body.action === "list") return { tracks: [] };
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای مدیریت موسیقی تنظیم نشده است." });
  }
  const sql = await getSql();
  const action = body.action ?? "list";
  if (action === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      `select id, title, artist, url, mime_type, size_bytes, active, position, created_at
       from music_tracks order by position asc, created_at desc`,
    );
    return { tracks: rows.map((row) => ({
      id: String(row.id), title: String(row.title), artist: String(row.artist ?? ""), url: normalizeBlobUrl(String(row.url)),
      mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes) || 0, active: Boolean(row.active),
      position: Number(row.position) || 0, createdAt: new Date(String(row.created_at)).toISOString(),
    })) };
  }

  if (action === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const artist = typeof body.artist === "string" ? body.artist.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const sizeBytes = Number(body.sizeBytes) || 0;

    if (!title || title.length > 160) {
      throw createError({ statusCode: 400, statusMessage: "عنوان آهنگ نامعتبر است." });
    }
    if (artist.length > 120) {
      throw createError({ statusCode: 400, statusMessage: "نام هنرمند نامعتبر است." });
    }
    const normalizedUrl = normalizeBlobUrl(url);
    if (!isPublicBlobUrl(normalizedUrl) || !ALLOWED_MUSIC_TYPES.has(mimeType) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024) {
      throw createError({
        statusCode: 400,
        statusMessage: "فایل باید روی فضای عمومی Vercel Blob قرار گرفته باشد تا در مرورگر قابل پخش باشد.",
      });
    }

    const rows = await sql.query<Record<string, unknown>>(
      `insert into music_tracks (id, title, artist, url, mime_type, size_bytes, active, position)
       values ($1, $2, $3, $4, $5, $6, true, coalesce((select max(position) + 1 from music_tracks), 0))
       returning id, title, artist, url, mime_type, size_bytes, active, position, created_at`,
      [crypto.randomUUID(), title, artist, normalizedUrl, mimeType, sizeBytes],
    );
    const row = rows[0];
    return {
      track: {
        id: String(row.id),
        title: String(row.title),
        artist: String(row.artist ?? ""),
        url: String(row.url),
        mimeType: String(row.mime_type),
        sizeBytes: Number(row.size_bytes) || 0,
        active: Boolean(row.active),
        position: Number(row.position) || 0,
        createdAt: new Date(String(row.created_at)).toISOString(),
      },
    };
  }

  if (!body.id) throw createError({ statusCode: 400, statusMessage: "شناسه آهنگ مشخص نیست." });
  if (action === "toggle") {
    await sql.query("update music_tracks set active = $2, updated_at = current_timestamp where id = $1", [body.id, body.active === true]);
    return { success: true };
  }
  if (action === "delete") {
    const rows = await sql.query<{ url: string }>(
      "select url from music_tracks where id = $1 limit 1",
      [body.id],
    );
    const rawUrl = rows[0]?.url;

    if (rawUrl) {
      const blobUrl = normalizeBlobUrl(rawUrl);
      try {
        const parsed = new URL(blobUrl);
        if (
          parsed.protocol === "https:" &&
          parsed.hostname.endsWith(".public.blob.vercel-storage.com")
        ) {
          await del(blobUrl);
        }
      } catch (error) {
        console.error("[music-admin] blob cleanup failed", error);
      }
    }

    await sql.query("delete from music_tracks where id = $1", [body.id]);
    return { success: true };
  }
  throw createError({ statusCode: 400, statusMessage: "عملیات مدیریت موسیقی نامعتبر است." });
});