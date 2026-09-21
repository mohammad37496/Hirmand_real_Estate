/** Same-origin path prefix for media the app stores and serves itself. */
export const DB_MEDIA_PATH = "/api/media/";

/** Media slots a property gallery can hold. */
export const MAX_PROPERTY_MEDIA = 20;

/**
 * A gallery entry is either a remote `https://` URL or media we serve
 * ourselves from `/api/media/<id>`.
 */
export function isAllowedMediaRef(value: string): boolean {
  if (value.startsWith(DB_MEDIA_PATH) && value.length > DB_MEDIA_PATH.length) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Detect image vs video from URL or MIME. */
export function isVideoUrl(src: string): boolean {
  const lower = src.toLowerCase().split("?")[0] ?? src;
  return /\.(mp4|webm|mov|m4v|ogg)($|\/)/i.test(lower) || lower.includes("/video/");
}

export function isImageUrl(src: string): boolean {
  return !isVideoUrl(src);
}

export function isDivarRemoteHost(value: string): boolean {
  const match = value.trim().match(/^https?:\/\/([^/]+)/i);
  const host = match?.[1]?.toLowerCase().split(":")[0] ?? "";
  return (
    host === "divar.ir" ||
    host.endsWith(".divar.ir") ||
    host === "divar.com" ||
    host.endsWith(".divar.com") ||
    host.includes("divarcdn")
  );
}

/**
 * Ordered, browser-safe candidates for remote property media.
 *
 * Classifieds CDNs reject hotlink requests from a visitor's browser, so we try
 * the original URL, then our own proxy (same origin, no third party involved),
 * then public image proxies, and finally the local placeholder.
 */
export function mediaSourceCandidates(src: string, fallback = ""): string[] {
  const value = src.trim();
  if (!value) return fallback ? [fallback] : [];

  const isDivarRemote = isDivarRemoteHost(value);

  const proxies = isDivarRemote
    ? [
        `/api/media-proxy?url=${encodeURIComponent(value)}`,
        `https://wsrv.nl/?url=${encodeURIComponent(value)}`,
        `https://images.weserv.nl/?url=${encodeURIComponent(value)}`,
      ]
    : [];

  return Array.from(new Set([value, ...proxies, fallback].filter(Boolean)));
}
