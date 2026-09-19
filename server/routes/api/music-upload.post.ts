import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createError, defineEventHandler } from "h3";

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
const MAX_BYTES = 100 * 1024 * 1024;

function parsePayload(clientPayload: string | null) {
  if (!clientPayload) return null;
  try {
    const value = JSON.parse(clientPayload) as {
      adminKey?: unknown;
      title?: unknown;
      artist?: unknown;
    };
    return {
      adminKey: typeof value.adminKey === "string" ? value.adminKey.trim() : "",
      title: typeof value.title === "string" ? value.title.trim() : "",
      artist: typeof value.artist === "string" ? value.artist.trim() : "",
    };
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  let body: HandleUploadBody;
  try {
    body = (await event.req.json()) as HandleUploadBody;
  } catch {
    throw createError({ statusCode: 400, statusMessage: "درخواست آپلود موسیقی نامعتبر است." });
  }

  try {
    return await handleUpload({
      body,
      request: event.req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        const expected = process.env.HIRMAND_ADMIN_KEY?.trim();

        if (!expected || !payload?.adminKey || payload.adminKey !== expected) {
          throw new Error("کلید مدیریت نادرست است.");
        }
        if (!payload.title || payload.title.length > 160) {
          throw new Error("عنوان آهنگ الزامی و حداکثر ۱۶۰ کاراکتر است.");
        }
        if (payload.artist.length > 120) {
          throw new Error("نام هنرمند بیش از حد طولانی است.");
        }
        if (!pathname.startsWith("music/")) {
          throw new Error("مسیر آپلود نامعتبر است.");
        }

        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            title: payload.title,
            artist: payload.artist,
          }),
        };
      },
      onUploadCompleted: async () => {
        // The browser finalizes the database row after Blob returns its URL.
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "توکن آپلود موسیقی ساخته نشد.";
    throw createError({ statusCode: 400, statusMessage: message });
  }
});
