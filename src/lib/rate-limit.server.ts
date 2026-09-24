import { createHash } from "node:crypto";
import { getHeader, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identity?: string | null;
};

function clientAddress(event: H3Event): string {
  const forwarded = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim();
  const real = getHeader(event, "x-real-ip")?.trim();
  const socketAddress = event.node?.req?.socket?.remoteAddress?.trim();
  return forwarded || real || socketAddress || "unknown";
}

function normalizedIdentity(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 220);
}

function bucketKey(scope: string, identity: string): string {
  const salt =
    process.env.RATE_LIMIT_SALT?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "hirmand-rate-limit";
  return createHash("sha256")
    .update(salt)
    .update(":")
    .update(scope)
    .update(":")
    .update(identity)
    .digest("hex");
}

/**
 * Distributed fixed-window limiter backed by PostgreSQL.
 * It is intentionally fail-open when the limiter storage itself is unavailable:
 * an outage in the guard table must not turn normal public browsing into a 500.
 */
export async function enforceRateLimit(
  event: H3Event,
  options: RateLimitOptions,
): Promise<boolean> {
  if (dbSource === "unconfigured") return true;

  const scope = options.scope.trim().slice(0, 100);
  const identity = [
    clientAddress(event),
    normalizedIdentity(options.identity),
  ].join("|");
  const key = bucketKey(scope, identity);

  try {
    const sql = await getSql();
    const rows = await sql.query<{
      request_count: number;
      window_started_at: string;
    }>(
      `insert into api_rate_limit_buckets (bucket_key, window_started_at, request_count)
       values ($1, current_timestamp, 1)
       on conflict (bucket_key) do update set
         window_started_at =
           case
             when api_rate_limit_buckets.window_started_at
                  <= current_timestamp - ($3::text || ' seconds')::interval
             then current_timestamp
             else api_rate_limit_buckets.window_started_at
           end,
         request_count =
           case
             when api_rate_limit_buckets.window_started_at
                  <= current_timestamp - ($3::text || ' seconds')::interval
             then 1
             else api_rate_limit_buckets.request_count + 1
           end
       returning request_count, window_started_at`,
      [key, Math.max(1, Math.floor(options.limit)), Math.max(1, Math.floor(options.windowSeconds))],
    );

    const row = rows[0];
    if (!row) return true;

    const count = Number(row.request_count) || 0;
    const allowed = count <= options.limit;
    if (!allowed) {
      const started = new Date(String(row.window_started_at)).getTime();
      const retryAfter = Math.max(
        1,
        Math.ceil((started + options.windowSeconds * 1000 - Date.now()) / 1000),
      );
      setResponseHeader(event, "retry-after", String(retryAfter));
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[rate-limit] limiter unavailable", error instanceof Error ? error.message : error);
    return true;
  }
}
