/** Detect image vs video from URL or MIME. */
export function isVideoUrl(src: string): boolean {
  const lower = src.toLowerCase().split("?")[0] ?? src;
  return /\.(mp4|webm|mov|m4v|ogg)($|\/)/i.test(lower) || lower.includes("/video/");
}

export function isImageUrl(src: string): boolean {
  return !isVideoUrl(src);
}

/**
 * Returns a deterministic set of browser-safe fallbacks for remote property
 * media. Some classifieds/CDN hosts reject hotlink requests, so we try the
 * original URL first and then image proxy providers before using the local
 * property-type placeholder.
 */
export function mediaSourceCandidates(src: string, fallback = ""): string[] {
  const value = src.trim();
  if (!value) return fallback ? [fallback] : [];

  const hostnameMatch = value.match(/^https?:\/\/([^/]+)/i);
  const hostname = hostnameMatch?.[1]?.toLowerCase() ?? "";
  const isDivarRemote =
    hostname.endsWith("divarcdn.com") ||
    hostname === "divar.ir" ||
    hostname.endsWith(".divar.ir") ||
    hostname === "divar.com" ||
    hostname.endsWith(".divar.com") ||
    hostname.includes("divarcdn");

  const proxies = isDivarRemote
    ? [
        `https://wsrv.nl/?url=${encodeURIComponent(value)}`,
        `https://images.weserv.nl/?url=${encodeURIComponent(value)}`,
      ]
    : [];

  return Array.from(new Set([value, ...proxies, fallback].filter(Boolean)));
}
