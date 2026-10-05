/**
 * Per-device throttling for the Phone Bridge endpoints.
 *
 * Separate from the admin limiter on purpose: those key off an IP + user-agent
 * fingerprint of an unauthenticated browser, these key off an authenticated
 * device id, and the budgets are sized differently. A device that legitimately
 * syncs every 15 minutes must never be treated like a login form.
 *
 * The counter lives in Redis when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * are set, and in a process-local Map otherwise — the same split (and the same
 * "degrade instead of throw" rule) as src/lib/admin-rate-limit.server.ts, because
 * a limiter that throws takes the whole sync path down with it.
 */

type Bucket = { hits: number[]; blockedUntil: number };

interface ThrottleStore {
  get(key: string): Promise<Bucket | undefined>;
  set(key: string, bucket: Bucket): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Budgets per endpoint class, per device, per window.
 *
 * `heartbeat` and `remote-command` are polled on a timer by the app, so they get
 * the loosest budget; `register` and `files` are the expensive / abusable ones.
 */
export const PHONE_BRIDGE_LIMITS = {
  register: { max: 10, windowMs: 15 * 60 * 1000 },
  sync: { max: 60, windowMs: 10 * 60 * 1000 },
  heartbeat: { max: 120, windowMs: 10 * 60 * 1000 },
  location: { max: 600, windowMs: 10 * 60 * 1000 },
  files: { max: 60, windowMs: 10 * 60 * 1000 },
  "remote-command": { max: 240, windowMs: 10 * 60 * 1000 },
  result: { max: 240, windowMs: 10 * 60 * 1000 },
} as const;

export type PhoneBridgeLimitKey = keyof typeof PHONE_BRIDGE_LIMITS;

const BLOCK_MS = 5 * 60 * 1000;
const KEY_TTL_SECONDS = Math.ceil((10 * 60 * 1000 + BLOCK_MS) / 1000);

/* ------------------------------------------------------------------ */
/* In-memory store — single process, dev / self-hosted                */
/* ------------------------------------------------------------------ */

const globalRef = globalThis as typeof globalThis & {
  __phoneBridgeRateLimits__?: Map<string, Bucket>;
  __phoneBridgeThrottleStoreBroken?: boolean;
};

function memoryStore(): ThrottleStore {
  const buckets = (globalRef.__phoneBridgeRateLimits__ ??= new Map());
  return {
    async get(key) {
      return buckets.get(key);
    },
    async set(key, bucket) {
      buckets.set(key, bucket);
    },
    async delete(key) {
      buckets.delete(key);
    },
  };
}

function pruneMemory(store: Map<string, Bucket>, now: number) {
  for (const [key, bucket] of store) {
    const expired = bucket.blockedUntil < now && bucket.hits.every((hit) => now - hit > 60 * 60 * 1000);
    if (expired) store.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/* Upstash Redis store — shared across every serverless instance      */
/* ------------------------------------------------------------------ */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand<T>(...command: (string | number)[]): Promise<T> {
  const response = await fetch(`${REST_URL}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Redis responded ${response.status}`);
  const payload = (await response.json()) as { result: T };
  return payload.result;
}

function redisStore(): ThrottleStore {
  return {
    async get(key) {
      const raw = await redisCommand<string | null>("GET", `hirmand:pb-rate:${key}`);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Bucket;
      return Array.isArray(parsed.hits) ? parsed : undefined;
    },
    async set(key, bucket) {
      await redisCommand("SET", `hirmand:pb-rate:${key}`, JSON.stringify(bucket), "EX", KEY_TTL_SECONDS);
    },
    async delete(key) {
      await redisCommand("DEL", `hirmand:pb-rate:${key}`);
    },
  };
}

function warnOnce(error: unknown) {
  if (globalRef.__phoneBridgeThrottleStoreBroken) return;
  globalRef.__phoneBridgeThrottleStoreBroken = true;
  console.error(
    "[phone-bridge-rate-limit] Redis store unavailable, falling back to the in-process counter:",
    error instanceof Error ? error.message : error,
  );
}

function store(): ThrottleStore {
  if (!REST_URL || !REST_TOKEN) return memoryStore();
  const shared = redisStore();
  const fallback = memoryStore();
  return {
    get: (key) => shared.get(key).catch((error) => (warnOnce(error), fallback.get(key))),
    set: (key, bucket) => shared.set(key, bucket).catch((error) => (warnOnce(error), fallback.set(key, bucket))),
    delete: (key) => shared.delete(key).catch((error) => (warnOnce(error), fallback.delete(key))),
  };
}

/* ------------------------------------------------------------------ */

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Records a hit for `key` and reports whether the caller may continue. */
export async function consumePhoneBridgeAttempt(
  key: PhoneBridgeLimitKey,
  identity: string,
): Promise<RateLimitResult> {
  const { max, windowMs } = PHONE_BRIDGE_LIMITS[key];
  const now = Date.now();
  const storeKey = `${key}:${identity}`;
  const target = store();

  if (globalRef.__phoneBridgeRateLimits__) pruneMemory(globalRef.__phoneBridgeRateLimits__, now);

  const bucket = (await target.get(storeKey).catch((error) => {
    warnOnce(error);
    return undefined;
  })) ?? { hits: [], blockedUntil: 0 };

  if (bucket.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.hits = bucket.hits.filter((hit) => now - hit <= windowMs);
  bucket.hits.push(now);

  if (bucket.hits.length > max) {
    bucket.blockedUntil = now + BLOCK_MS;
    bucket.hits = [];
    await target.set(storeKey, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
  }

  await target.set(storeKey, bucket);
  return { allowed: true, remaining: Math.max(0, max - bucket.hits.length), retryAfterSeconds: 0 };
}