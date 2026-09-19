import { issueSignedToken, presignUrl } from "@vercel/blob";
import { createError, defineEventHandler, readBody } from "h3";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = [
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
];

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    adminKey?: string;
    pathname?: string;
    title?: string;
    artist?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  const adminKey = typeof body.adminKey === "string" ? body.adminKey.trim() : "";
  if (!expected || !adminKey || adminKey !== expected) {
    throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  }

  const pathname = typeof body.pathname === "string" ? body.pathname.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "";
  const sizeBytes = Number(body.sizeBytes) || 0;

  if (!pathname.startsWith("music/")) {
    throw createError({ statusCode: 400, statusMessage: "مسیر فایل موسیقی نامعتبر است." });
  }
  if (!title || title.length > 160) {
    throw createError({ statusCode: 400, statusMessage: "عنوان آهنگ نامعتبر است." });
  }
  if (artist.length > 120) {
    throw createError({ statusCode: 400, statusMessage: "نام هنرمند نامعتبر است." });
  }
  if (!ALLOWED.includes(contentType) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "نوع یا حجم فایل صوتی نامعتبر است." });
  }

  try {
    const validUntil = Date.now() + 15 * 60 * 1000;
    const signedToken = await issueSignedToken({
      pathname,
      operations: ["put"],
      validUntil,
      maximumSizeInBytes: MAX_BYTES,
      allowedContentTypes: ALLOWED,
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      pathname,
      operation: "put",
      validUntil,
      access: "public",
    });

    return {
      presignedUrl,
      expiresAt: validUntil,
      title,
      artist,
      contentType,
      sizeBytes,
    };
  } catch (error) {
    console.error("[music-upload] presign failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "ساخت لینک امن آپلود موسیقی انجام نشد.";
    throw createError({
      statusCode: 503,
      statusMessage: message,
    });
  }
});
