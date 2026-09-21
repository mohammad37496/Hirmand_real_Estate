import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { del } from "@vercel/blob";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import {
  isPrivateBlobUrl,
  isPublicBlobUrl,
  normalizePublicBlobUrl,
} from "@/lib/blob-url";

type Action = "list" | "create" | "toggle" | "delete";
type Body = {
  action?: Action;
  id?: string;
  active?: boolean;
  title?: string;
  artist?: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
};

const ALLOWED_MUSIC_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);
const MAX_BYTES = 100 * 1024 * 1024;

async function verifyPublicAudio(url: string, expectedMimeType: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      headers: { range: "bytes=0-1" },
      signal: controller.signal,
    });
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const canonicalExpected =
      expectedMimeType === "audio/mp3"
        ? "audio/mpeg"
        : expectedMimeType === "audio/x-wav"
          ? "audio/wav"
          : expectedMimeType === "audio/x-m4a"
            ? "audio/mp4"
            : expectedMimeType;

    if (!response.ok && response.status !== 206) {
      throw new Error(`Blob responded with HTTP ${response.status}`);
    }
    if (!contentType.startsWith("audio/")) {
      throw new Error(`Blob content-type is ${contentType || "missing"}`);
    }
    if (canonicalExpected && contentType !== canonicalExpected) {
      throw new Error(`Blob content-type ${contentType} differs from ${canonicalExpected}`);
    }
    await response.body?.cancel();
  } finally {
    clearTimeout(timeout);
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = (await readBody(event)) as Body;

  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید." });
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
    return {
      tracks: rows.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        artist: String(row.artist ?? ""),
        url: normalizePublicBlobUrl(String(row.url)),
        mimeType: String(row.mime_type),
        sizeBytes: Number(row.size_bytes) || 0,
        active: Boolean(row.active),
        position: Number(row.position) || 0,
        createdAt: new Date(String(row.created_at)).toISOString(),
      })),
    };
  }

  if (action === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const artist = typeof body.artist === "string" ? body.artist.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
    const sizeBytes = Number(body.sizeBytes) || 0;

    if (!title || title.length > 160) throw createError({ statusCode: 400, statusMessage: "عنوان آهنگ نامعتبر است." });
    if (artist.length > 120) throw createError({ statusCode: 400, statusMessage: "نام هنرمند نامعتبر است." });
    if (!ALLOWED_MUSIC_TYPES.has(mimeType)) throw createError({ statusCode: 415, statusMessage: "فرمت فایل صوتی مجاز نیست." });
    if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: "حجم فایل صوتی بیش از ۱۰۰ مگابایت است." });

    const normalizedUrl = normalizePublicBlobUrl(url);

    if (isPrivateBlobUrl(normalizedUrl) || isPrivateBlobUrl(url)) {
      throw createError({
        statusCode: 422,
        statusMessage: "فایل موسیقی روی فضای Private Blob قرار گرفته است. برای پخش عمومی، یک Public Blob Store به پروژه متصل کنید.",
      });
    }
    if (!isPublicBlobUrl(normalizedUrl)) {
      throw createError({
        statusCode: 422,
        statusMessage: "نشانی فایل موسیقی عمومی و قابل پخش نیست. اتصال Public Blob را بررسی کنید.",
      });
    }

    try {
      await verifyPublicAudio(normalizedUrl, mimeType);
    } catch (error) {
      console.error("[music-admin] public audio verification failed", error);
      throw createError({
        statusCode: 502,
        statusMessage: "آپلود انجام شد اما فایل از Public Blob قابل دریافت نیست؛ اتصال Blob و MIME فایل را بررسی کنید.",
      });
    }

    const rows = await sql.query<Record<string, unknown>>(
      `insert into music_tracks
        (id, title, artist, url, mime_type, size_bytes, active, position)
       values
        ($1, $2, $3, $4, $5, $6, true, coalesce((select max(position) + 1 from music_tracks), 0))
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
    await sql.query(
      "update music_tracks set active = $2, updated_at = current_timestamp where id = $1",
      [body.id, body.active === true],
    );
    return { success: true };
  }

  if (action === "delete") {
    const rows = await sql.query<{ url: string }>("select url from music_tracks where id = $1 limit 1", [body.id]);
    const rawUrl = rows[0]?.url;
    if (rawUrl) {
      const blobUrl = normalizePublicBlobUrl(rawUrl);
      try {
        if (isPublicBlobUrl(blobUrl)) await del(blobUrl);
      } catch (error) {
        console.error("[music-admin] blob cleanup failed", error);
      }
    }
    await sql.query("delete from music_tracks where id = $1", [body.id]);
    return { success: true };
  }

  throw createError({ statusCode: 400, statusMessage: "عملیات مدیریت موسیقی نامعتبر است." });
});
