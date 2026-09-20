import { createError, getHeader } from "h3";

 type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanupAt = 0;

function clientKey(event: Parameters<typeof getHeader>[0]): string {
  const forwarded = getHeader(event, "x-forwarded-for");
  const realIp = getHeader(event, "x-real-ip");
  const value = forwarded || realIp || "unknown";
  return value.split(",")[0]?.trim().slice(0, 128) || "unknown";
}

function cleanup(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort per-instance rate limiting for public/server endpoints.
 * A Vercel deployment should also add an edge/WAF limit for distributed traffic.
 */
export function enforceRateLimit(
  event: Parameters<typeof getHeader>[0],
  name: string,
  limit: number,
  windowMs = 60_000,
) {
  const now = Date.now();
  cleanup(now);
  const key = `${name}:${clientKey(event)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw createError({
      statusCode: 429,
      statusMessage: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید.",
      data: { retryAfter },
    });
  }

  current.count += 1;
}
