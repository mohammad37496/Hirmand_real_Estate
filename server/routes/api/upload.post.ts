import { defineEventHandler, readMultipartFormData, createError } from "h3";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/**
 * POST /api/upload
 * multipart: adminKey + file
 * Requires BLOB_READ_WRITE_TOKEN (Vercel Blob).
 */
export default defineEventHandler(async (event) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token && !(process.env.VERCEL === "1" || process.env.VERCEL === "true")) {
    throw createError({
      statusCode: 503,
      statusMessage: "آپلود فایل روی محیط محلی فعال نیست. در Vercel از Vercel Blob/OIDC استفاده می‌شود.",
    });
  }

  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "فایلی ارسال نشد." });
  }

  const adminKey = parts
    .find((p) => p.name === "adminKey")
    ?.data
    ? Buffer.from(parts.find((p) => p.name === "adminKey")?.data ?? []).toString("utf8").trim()
    : undefined;
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey !== expected) {
    throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  }

  const filePart = parts.find((p) => p.name === "file" && p.data && p.filename);
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: "فایل یافت نشد." });
  }

  if (filePart.data.byteLength > MAX_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "حجم فایل بیش از ۴ مگابایت است؛ برای ویدیوهای بزرگ‌تر باید آپلود مستقیم به Blob فعال شود.",
    });
  }

  const type = filePart.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    throw createError({
      statusCode: 415,
      statusMessage: "فقط تصویر (jpg/png/webp/gif) یا ویدیو (mp4/webm) مجاز است.",
    });
  }

  const safeName = (filePart.filename || "media")
    .replace(/[^\w.\u0600-\u06FF-]+/g, "-")
    .slice(0, 80);
  const pathname = `properties/${Date.now()}-${safeName}`;

  if (!token) {
    throw createError({
      statusCode: 503,
      statusMessage: "توکن Vercel Blob در محیط استقرار تنظیم نشده است.",
    });
  }

  const blobResponse = await fetch(
    `https://blob.vercel-storage.com/${pathname}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-version": "7",
        "content-type": type,
        "x-content-type": type,
      },
      body: Buffer.from(filePart.data),
    },
  );

  if (!blobResponse.ok) {
    const detail = await blobResponse.text().catch(() => "");
    console.error("[upload] Vercel Blob upload failed", blobResponse.status, detail.slice(0, 300));
    throw createError({
      statusCode: 502,
      statusMessage: "آپلود در فضای رسانه‌ای انجام نشد.",
    });
  }

  const blob = (await blobResponse.json()) as { url?: string };
  if (!blob.url) {
    throw createError({ statusCode: 502, statusMessage: "پاسخ فضای رسانه‌ای معتبر نیست." });
  }

  return {
    url: blob.url,
    contentType: type,
    size: filePart.data.byteLength,
    kind: type.startsWith("video/") ? "video" : "image",
  };
});
