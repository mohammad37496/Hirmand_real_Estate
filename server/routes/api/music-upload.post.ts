import { defineEventHandler, readMultipartFormData, createError } from "h3";
import { dbSource, getSql } from "@/lib/db";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["audio/mpeg","audio/mp3","audio/ogg","audio/wav","audio/x-wav","audio/mp4","audio/x-m4a","audio/aac"]);

function textPart(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) {
  const data = parts?.find((part) => part.name === name)?.data;
  return data ? Buffer.from(data).toString("utf8").trim() : "";
}

export default defineEventHandler(async (event) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const parts = await readMultipartFormData(event);
  if (!parts?.length) throw createError({ statusCode: 400, statusMessage: "فایلی ارسال نشد." });
  const adminKey = textPart(parts, "adminKey");
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey !== expected) throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای ذخیره موسیقی تنظیم نشده است." });
  if (!token) throw createError({ statusCode: 503, statusMessage: "Vercel Blob برای آپلود موسیقی تنظیم نشده است." });
  const title = textPart(parts, "title");
  const artist = textPart(parts, "artist");
  if (!title || title.length > 160) throw createError({ statusCode: 400, statusMessage: "عنوان آهنگ الزامی و حداکثر ۱۶۰ کاراکتر است." });
  if (artist.length > 120) throw createError({ statusCode: 400, statusMessage: "نام خواننده بیش از حد طولانی است." });
  const filePart = parts.find((part) => part.name === "file" && part.data && part.filename);
  if (!filePart?.data) throw createError({ statusCode: 400, statusMessage: "فایل صوتی پیدا نشد." });
  if (filePart.data.byteLength > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: "حجم آهنگ بیش از ۸ مگابایت است." });
  const type = filePart.type || "application/octet-stream";
  if (!ALLOWED.has(type)) throw createError({ statusCode: 415, statusMessage: "فقط MP3، OGG، WAV، M4A یا AAC مجاز است." });
  const safeName = (filePart.filename || "track").replace(/[^\w.\u0600-\u06FF-]+/g, "-").slice(0, 100);
  const pathname = `music/${Date.now()}-${safeName}`;
  const blobResponse = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "x-api-version": "7", "content-type": type, "x-content-type": type },
    body: Buffer.from(filePart.data),
  });
  if (!blobResponse.ok) {
    const detail = await blobResponse.text().catch(() => "");
    console.error("[music-upload] Blob upload failed", blobResponse.status, detail.slice(0, 300));
    throw createError({ statusCode: 502, statusMessage: "آپلود آهنگ انجام نشد." });
  }
  const blob = (await blobResponse.json()) as { url?: string };
  if (!blob.url) throw createError({ statusCode: 502, statusMessage: "پاسخ فضای رسانه‌ای معتبر نیست." });
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `insert into music_tracks (id, title, artist, url, mime_type, size_bytes, active, position)
     values ($1, $2, $3, $4, $5, $6, true, coalesce((select max(position) + 1 from music_tracks), 0))
     returning id, title, artist, url, mime_type, size_bytes, active, position, created_at`,
    [crypto.randomUUID(), title, artist, blob.url, type, filePart.data.byteLength],
  );
  const row = rows[0];
  return { track: {
    id: String(row.id), title: String(row.title), artist: String(row.artist ?? ""), url: String(row.url),
    mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes) || 0, active: Boolean(row.active),
    position: Number(row.position) || 0, createdAt: new Date(String(row.created_at)).toISOString(),
  } };
});