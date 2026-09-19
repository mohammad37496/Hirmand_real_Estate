import { defineEventHandler, readBody, createError } from "h3";
import { dbSource, getSql } from "@/lib/db";

type Action = "list" | "create" | "toggle" | "delete";
type Body = { action?: Action; adminKey?: string; id?: string; active?: boolean; title?: string; artist?: string; url?: string; mimeType?: string; sizeBytes?: number };
const ALLOWED_MUSIC_TYPES = new Set(["audio/mpeg","audio/mp3","audio/ogg","audio/wav","audio/x-wav","audio/mp4","audio/x-m4a","audio/aac"]);

function normalizeBlobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const delegation = url.searchParams.get("vercel-blob-delegation");
    if (!delegation) {
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

function requireAdmin(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey.trim() !== expected) {
    throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body;
  requireAdmin(body.adminKey);
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
    if (!/^https:\/\//i.test(url) || !ALLOWED_MUSIC_TYPES.has(mimeType) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024) {
      throw createError({ statusCode: 400, statusMessage: "اطلاعات فایل صوتی نامعتبر است." });
    }

    const rows = await sql.query<Record<string, unknown>>(
      `insert into music_tracks (id, title, artist, url, mime_type, size_bytes, active, position)
       values ($1, $2, $3, $4, $5, $6, true, coalesce((select max(position) + 1 from music_tracks), 0))
       returning id, title, artist, url, mime_type, size_bytes, active, position, created_at`,
      [crypto.randomUUID(), title, artist, url, mimeType, sizeBytes],
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
    await sql.query("delete from music_tracks where id = $1", [body.id]);
    return { success: true };
  }
  throw createError({ statusCode: 400, statusMessage: "عملیات مدیریت موسیقی نامعتبر است." });
});