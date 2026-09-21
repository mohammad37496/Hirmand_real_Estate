import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createError, defineEventHandler, getCookie, readBody } from "h3";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

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

function mimeFromPathname(pathname: string) {
  const extension = pathname.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "ogg" || extension === "oga") return "audio/ogg";
  if (extension === "wav") return "audio/wav";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "aac") return "audio/aac";
  return "";
}

export default defineEventHandler(async (event) => {
  const requestBody = (await readBody(event)) as HandleUploadBody;

  try {
    if (
      requestBody.type === "blob.generate-client-token" &&
      !await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))
    ) {
      throw createError({
        statusCode: 401,
        statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید.",
      });
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
        const declaredContentType =
          typeof payload.contentType === "string" ? payload.contentType.trim().toLowerCase() : "";
        const contentType =
          ALLOWED.includes(declaredContentType)
            ? declaredContentType
            : mimeFromPathname(pathname);
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
