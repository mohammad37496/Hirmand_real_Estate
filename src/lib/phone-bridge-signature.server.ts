/**
 * HMAC request signing for Phone Bridge — the server half of the contract
 * implemented by `android/app/src/main/java/ir/hirmand/phonebridge/sync/SignedRequest.kt`.
 *
 * The canonical string is part of the wire protocol, not an implementation
 * detail. Android builds:
 *
 *   v1.<deviceId>.<timestamp>.<nonce>.<sha256hex(body)>
 *
 * and signs it with HMAC-SHA256 keyed by the per-device token, hex encoded.
 * `phone-bridge-signature.test.ts` pins both halves of that string, so a change
 * on either side fails CI instead of silently 401-ing every device.
 *
 * Headers:
 *   X-Hirmand-Timestamp      epoch milliseconds
 *   X-Hirmand-Nonce          base64url, 24 random bytes
 *   X-Hirmand-Signature      lowercase hex HMAC-SHA256
 *   X-Hirmand-Signature-Version "1"
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Version marker inside the canonical string. Bumped only on a protocol change. */
export const SIGNATURE_VERSION = "1";

/**
 * The literal prefix Android puts in front of the version.
 *
 * Kotlin builds `"v1.$deviceId..."` — the letter `v` is part of the wire format,
 * not the version number. Omitting it produces a string that looks right and
 * verifies nothing, so it is named separately here and asserted by
 * `phone-bridge-signature.test.ts`.
 */
export const SIGNATURE_PREFIX = `v${SIGNATURE_VERSION}`;

/** Requests older/newer than this are rejected before the HMAC is even checked. */
export const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;

const HEX_64 = /^[0-9a-f]{64}$/;

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

/**
 * The exact string Android signs. Exported so tests (and any future client)
 * build it the same way rather than by hand-formatting a template.
 */
export function canonicalSigningInput(input: {
  deviceId: string;
  timestamp: string;
  nonce: string;
  body: Uint8Array | string;
}): string {
  const bodyHash = sha256Hex(input.body);
  return `${SIGNATURE_PREFIX}.${input.deviceId}.${input.timestamp}.${input.nonce}.${bodyHash}`;
}

export type SignatureHeaders = {
  timestamp: string | undefined;
  nonce: string | undefined;
  signature: string | undefined;
  version: string | undefined;
};

/**
 * Structural + temporal validation only. Returns a discriminated result so the
 * caller can map each failure onto the right HTTP status: a malformed header is
 * 401, a stale timestamp is 408 (the client should resend, not re-register).
 */
export function checkSignatureFreshness(
  headers: SignatureHeaders,
  options: { now?: number; maxSkewMs?: number } = {},
): { ok: true } | { ok: false; reason: "missing" | "malformed" | "stale" } {
  const { timestamp, nonce, signature, version } = headers;

  if (!timestamp || !nonce || !signature) return { ok: false, reason: "missing" };
  if (version && version !== SIGNATURE_VERSION) return { ok: false, reason: "malformed" };

  if (!/^\d{1,15}$/.test(timestamp)) return { ok: false, reason: "malformed" };
  if (nonce.length > 128) return { ok: false, reason: "malformed" };
  if (!HEX_64.test(signature.toLowerCase())) return { ok: false, reason: "malformed" };

  const now = options.now ?? Date.now();
  const skew = Math.abs(now - Number(timestamp));
  if (skew > (options.maxSkewMs ?? DEFAULT_CLOCK_SKEW_MS)) return { ok: false, reason: "stale" };

  return { ok: true };
}

/**
 * Verifies the HMAC. Both sides must be 32-byte hex strings before
 * `timingSafeEqual` is reached — that call throws on a length mismatch, which
 * would otherwise turn a malformed header into a 500.
 */
export function verifySignature(input: {
  secret: string;
  deviceId: string;
  timestamp: string;
  nonce: string;
  signature: string;
  body: Uint8Array | string;
}): boolean {
  const expected = hmacSha256Hex(
    input.secret,
    canonicalSigningInput({
      deviceId: input.deviceId,
      timestamp: input.timestamp,
      nonce: input.nonce,
      body: input.body,
    }),
  );

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(input.signature.toLowerCase(), "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/**
 * Replay protection for a single nonce.
 *
 * `X-Hirmand-Nonce` alone does nothing against replay — the value is public to
 * anyone who has seen one request. What makes a captured request unusable is
 * remembering the nonces, so a replayed signature is refused even inside the
 * freshness window. The window is bounded by the same skew the signature check
 * uses, so the store is self-cleaning.
 */
const globalRef = globalThis as typeof globalThis & {
  __phoneBridgeNonces__?: Map<string, number>;
};

function nonceStore(): Map<string, number> {
  return (globalRef.__phoneBridgeNonces__ ??= new Map());
}

/** Drops nonces that can no longer be inside their acceptance window. */
function pruneNonces(now: number, maxSkewMs: number): void {
  const store = nonceStore();
  for (const [nonce, seenAt] of store) {
    if (now - seenAt > maxSkewMs) store.delete(nonce);
  }
}

/**
 * Records a nonce, returning false when it was already used.
 *
 * A rejected replay still consumes its nonce: re-sending the same request must
 * keep failing rather than flip-flopping on the store.
 */
export function rememberNonce(
  deviceId: string,
  nonce: string,
  options: { now?: number; maxSkewMs?: number } = {},
): boolean {
  const now = options.now ?? Date.now();
  const maxSkewMs = options.maxSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  pruneNonces(now, maxSkewMs);

  const store = nonceStore();
  const key = `${deviceId}:${nonce}`;
  if (store.has(key)) return false;
  store.set(key, now);
  return true;
}