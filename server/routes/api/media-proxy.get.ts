import { createError, defineEventHandler, getQuery } from "h3";

/**
 * Same-origin image proxy for classifieds CDNs that block hotlinking.
 *
 * Divar's image CDN answers server-to-server requests but frequently refuses a
 * browser request coming from another origin, which is why imported listings can
 * end up with missing photos. Proxying them through our own origin fixes the
 * grid without depending on a third-party proxy service.
 */

const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

const ALLOWED_HOSTS = [
  "divar.ir",
  "divar.com",
  "divarcdn.com",
  "i.divar.ir",
  "sin.divar.ir",
  "cdn.divar.ir",
  "images.divar.ir",
  "media.divar.ir",
];

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith("." + allowed));
}

function detectImageType(bytes: Uint8Array, headerType: string): string {
  if (/^image\/(jpeg|png|webp|gif|avif)/i.test(headerType)) {
    return headerType.split(";")[0]!.trim().toLowerCase();
  }
  const hex = Buffer.from(bytes.subarray(0, 8)).toString("hex");
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("47494638")) return "image/gif";
  const ascii = Buffer.from(bytes.subarray(0, 12)).toString("ascii");
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  return "";
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as { url?: string };
  const raw = typeof query.url === "string" ? query.url.trim() : "";

  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: "نشانی تصویر مشخص نیست." });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "نشانی تصویر نامعتبر است." });
  }

  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    throw createError({
      statusCode: 400,
      statusMessage: "پروکسی تصویر فقط برای منابع مجاز فعال است.",
    });
  }

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      redirect: "follow",
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        "accept-language": "fa-IR,fa;q=0.9,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "دریافت تصویر از منبع ممکن نشد." });
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      statusMessage: "منبع تصویر پاسخ معتبری برنگرداند.",
    });
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) {
    throw createError({ statusCode: 502, statusMessage: "حجم تصویر نامعتبر است." });
  }

  const contentType = detectImageType(bytes, response.headers.get("content-type") ?? "");
  if (!contentType) {
    throw createError({ statusCode: 502, statusMessage: "محتوای دریافتی تصویر نیست." });
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
});
