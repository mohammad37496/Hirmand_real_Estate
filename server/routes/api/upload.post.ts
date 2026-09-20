import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createError, defineEventHandler, getHeader, readBody } from "h3";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as HandleUploadBody;

  try {
    if (body.type === "blob.generate-client-token") {
      const adminKey = getHeader(event, "x-hirmand-admin-key")?.trim();
      const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
      if (!expected || !adminKey || adminKey !== expected) {
        throw createError({
          statusCode: 401,
          statusMessage: "کلید مدیریت نادرست است.",
        });
      }
    }

    return await handleUpload({
      request: event.req,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("properties/")) {
          throw createError({
            statusCode: 400,
            statusMessage: "مسیر فایل ملک نامعتبر است.",
          });
        }

        let payload: { contentType?: unknown; sizeBytes?: unknown } = {};
        try {
          payload = clientPayload ? (JSON.parse(clientPayload) as typeof payload) : {};
        } catch {
          throw createError({
            statusCode: 400,
            statusMessage: "اطلاعات آپلود رسانه نامعتبر است.",
          });
        }

        const contentType =
          typeof payload.contentType === "string" ? payload.contentType.trim() : "";
        const sizeBytes = Number(payload.sizeBytes) || 0;

        if (!ALLOWED.includes(contentType)) {
          throw createError({
            statusCode: 415,
            statusMessage: "نوع فایل رسانه‌ای مجاز نیست.",
          });
        }
        if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
          throw createError({
            statusCode: 413,
            statusMessage: "حجم فایل بیش از ۲۵ مگابایت است.",
          });
        }

        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => undefined,
    });
  } catch (error) {
    console.error("[upload] client Blob upload setup failed", error);
    if (error && typeof error === "object" && "statusCode" in error) throw error;

    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error
          ? error.message
          : "ساخت مجوز آپلود رسانه انجام نشد.",
    });
  }
});
