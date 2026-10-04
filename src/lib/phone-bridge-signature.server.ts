import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";
import { getSql } from "@/lib/db";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;

function bearer(event: H3Event) {
  const auth = getHeader(event, "authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

function expectedSignature(secret: string, deviceId: string, timestamp: string, nonce: string, bodyHash: string) {
  return createHmac("sha256", secret)
    .update(`v1.${deviceId}.${timestamp}.${nonce}.${bodyHash}`, "utf8")
    .digest("hex");
}

function sameSignature(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateRequestNonce() {
  return randomBytes(24).toString("base64url");
}

export function signRequest(secret: string, deviceId: string, timestamp: string, nonce: string, body: Buffer | string) {
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return expectedSignature(secret, deviceId, timestamp, nonce, sha256(bodyBuffer));
}

export async function requirePhoneBridgeSignedRequest(
  event: H3Event,
  deviceId: string,
  body: Buffer | string,
) {
  const secret = bearer(event);
  const timestamp = getHeader(event, "x-hirmand-timestamp")?.trim() ?? "";
  const nonce = getHeader(event, "x-hirmand-nonce")?.trim() ?? "";
  const signature = getHeader(event, "x-hirmand-signature")?.trim().toLowerCase() ?? "";

  const timestampMs = Number(timestamp);
  if (!/^\\d{13}$/.test(timestamp) || !Number.isFinite(timestampMs)) {
    throw createError({ statusCode: 401, statusMessage: "امضای درخواست Phone Bridge ناقص است." });
  }
  if (!nonce || nonce.length > 160 || !/^[A-Za-z0-9_-]+$/.test(nonce)) {
    throw createError({ statusCode: 401, statusMessage: "شناسهٔ یکتای درخواست معتبر نیست." });
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    throw createError({ statusCode: 401, statusMessage: "امضای درخواست معتبر نیست." });
  }
  if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    throw createError({ statusCode: 401, statusMessage: "زمان درخواست Phone Bridge منقضی یا نامعتبر است." });
  }
  if (!secret) {
    throw createError({ statusCode: 401, statusMessage: "توکن Phone Bridge ارسال نشده است." });
  }

  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const expected = expectedSignature(secret, deviceId, timestamp, nonce, sha256(bodyBuffer));
  if (!sameSignature(signature, expected)) {
    throw createError({ statusCode: 401, statusMessage: "امضای درخواست Phone Bridge معتبر نیست." });
  }

  const sql = await getSql();
  await sql.query(
    `delete from phone_bridge_request_nonces
     where expires_at < current_timestamp`,
  );

  const inserted = await sql.query<{ nonce: string }>(
    `insert into phone_bridge_request_nonces(device_id,nonce,expires_at)
     values ($1,$2,$3)
     on conflict (device_id,nonce) do nothing
     returning nonce`,
    [
      deviceId,
      nonce,
      new Date(Date.now() + NONCE_TTL_MS).toISOString(),
    ],
  );

  if (inserted.length === 0) {
    throw createError({ statusCode: 409, statusMessage: "درخواست Phone Bridge دوباره ارسال شده است." });
  }
}
