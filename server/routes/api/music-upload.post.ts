import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createError, defineEventHandler, getHeader, readBody } from "h3";

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
  const requestBody = (await readBody(event)) as HandleUploadBody;

  try {
    const adminKey = getHeader(event, "x-hirmand-admin-key")?.trim();
    const expected = process.env.HIRMAND_ADMIN_KEY?.trim();

    if (requestBody.type === "blob.generate-client-token") {
      if (!expected || !adminKey || adminKey !== expected) {
        throw createError({
          statusCode: 401,
          statusMessage: "کلید مدیریت نادرست است.",
        });
      }
    }

    const jsonResponse = await handleUpload({
      request: event.req,
      body: requestBody,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        if (!pathname.startsWith("music/")) {
          throw createError({
            statusCode: 400,
            statusMessage: "مسیر فایل موسیقی نامعتبر است.",
          });
        }

        let payload: {
          title?: unknown;
          artist?: unknown;
          contentType?: unknown;
          sizeBytes?: unknown;
        } = {};

        try {
          payload = clientPayload
            ? (JSON.parse(clientPayload) as typeof payload)
            : {};
        } catch {
          throw createError({
            statusCode: 400,
            statusMessage: "اطلاعات آپلود موسیقی نامعتبر است.",
          });
        }

        const title = typeof payload.title === "string" ? payload.title.trim() : "";
        const artist = typeof payload.artist === "string" ? payload.artist.trim() : "";
        const contentType =
          typeof payload.contentType === "string" ? payload.contentType.trim() : "";
        const sizeBytes = Number(payload.sizeBytes) || 0;

        if (!title || title.length > 160) {
          throw createError({
            statusCode: 400,
            statusMessage: "عنوان آهنگ نامعتبر است.",
          });
        }
        if (artist.length > 120) {
          throw createError({
            statusCode: 400,
            statusMessage: "نام هنرمند نامعتبر است.",
          });
        }
        if (!ALLOWED.includes(contentType) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
          throw createError({
            statusCode: 400,
            statusMessage: "نوع یا حجم فایل صوتی نامعتبر است.",
          });
        }

        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            title,
            artist,
            contentType,
            sizeBytes,
            multipart: multipart === true,
          }),
        };
      },
      // The database record is created by the authenticated admin request
      // after upload() resolves. The callback is intentionally a no-op.
      onUploadCompleted: async () => undefined,
    });

    return jsonResponse;
  } catch (error) {
    console.error("[music-upload] client upload setup failed", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error
          ? error.message
          : "ساخت مجوز آپلود موسیقی انجام نشد.",
    });
  }
});
