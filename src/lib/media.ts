/** Detect image vs video from URL or MIME. */
export function isVideoUrl(src: string): boolean {
  const lower = src.toLowerCase().split("?")[0] ?? src;
  return /\.(mp4|webm|mov|m4v|ogg)($|\/)/i.test(lower) || lower.includes("/video/");
}

export function isImageUrl(src: string): boolean {
  return !isVideoUrl(src);
}

function isDivarHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith("divarcdn.com") ||
    host === "divar.ir" ||
    host.endsWith(".divar.ir") ||
    host === "divar.com" ||
    host.endsWith(".divar.com") ||
    host.includes("divarcdn")
  );
}

/**
 * Returns browser-safe candidates for remote property media. Divar often
 * serves media without a normal file extension and may reject hotlinking;
 * keep the original first, then deterministic image proxies, then a local
 * placeholder. The importer should still copy media to Blob for production.
 */
export function mediaSourceCandidates(src: string, fallback = ""): string[] {
  const value = src.trim();
  if (!value) return fallback ? [fallback] : [];

  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    return [value, fallback].filter(Boolean);
  }

  if (!isDivarHost(parsed.hostname)) return Array.from(new Set([value, fallback].filter(Boolean)));

  const encoded = encodeURIComponent(value);
  const proxies = [
    `https://wsrv.nl/?url=${encoded}`,
    `https://images.weserv.nl/?url=${encoded}`,
    `https://wsrv.nl/?url=${encoded}&output=jpg`,
  ];

  return Array.from(new Set([value, ...proxies, fallback].filter(Boolean)));
}
