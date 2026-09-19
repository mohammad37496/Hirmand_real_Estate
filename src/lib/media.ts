/** Detect image vs video from URL or MIME. */
export function isVideoUrl(src: string): boolean {
  const lower = src.toLowerCase().split("?")[0] ?? src;
  return /\.(mp4|webm|mov|m4v|ogg)($|\/)/i.test(lower) || lower.includes("/video/");
}

export function isImageUrl(src: string): boolean {
  return !isVideoUrl(src);
}
