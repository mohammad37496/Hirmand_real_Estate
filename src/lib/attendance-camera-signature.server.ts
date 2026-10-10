import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";
import { getSql } from "@/lib/db";
import { enforcePhoneBridgeRateLimit } from "@/lib/phone-bridge-rate-limit.server";

type HashableBody = Buffer | Uint8Array | string;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 15 * 60 * 1000;

function bodyHash(body: HashableBody) {
  return createHash("sha256").update(body).digest("hex");
}
function equalSignature(expected: string, actual: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(actual, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** HMAC authentication for the office-local attendance bridge. */
export async function requireSignedAttendanceCameraRequest(event: H3Event, body: HashableBody) {
  await enforcePhoneBridgeRateLimit(event, "attendance-camera", "shared-bridge", {
    windowMs: 10 * 60 * 1000, maxHits: 600, blockMs: 10 * 60 * 1000,
  });

  const secret = process.env.ATTENDANCE_CAMERA_SHARED_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: "پل دوربین حضور و غیاب هنوز در تنظیمات سرور فعال نشده است." });
  }

  const timestamp = getHeader(event, "x-hirmand-camera-timestamp")?.trim() ?? "";
  const nonce = getHeader(event, "x-hirmand-camera-nonce")?.trim() ?? "";
  const signature = getHeader(event, "x-hirmand-camera-signature")?.trim().toLowerCase() ?? "";

  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > MAX_CLOCK_SKEW_MS) {
    throw createError({ statusCode: 401, statusMessage: "زمان درخواست پل دوربین معتبر یا تازه نیست." });
  }
  if (!/^[A-Za-z0-9_-]{20,160}$/.test(nonce)) {
    throw createError({ statusCode: 401, statusMessage: "شناسه یکتای درخواست دوربین معتبر نیست." });
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    throw createError({ statusCode: 401, statusMessage: "امضای درخواست دوربین معتبر نیست." });
  }

  const canonical = "v1." + timestamp + "." + nonce + "." + bodyHash(body);
  const expected = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  if (!equalSignature(expected, signature)) {
    throw createError({ statusCode: 401, statusMessage: "امضای درخواست پل دوربین معتبر نیست." });
  }

  const sql = await getSql();
  await sql.query("delete from staff_attendance_camera_nonces where expires_at < current_timestamp");
  const inserted = await sql.query<{ nonce: string }>(
    "insert into staff_attendance_camera_nonces (nonce, expires_at) " +
      "values ($1, $2::timestamptz) on conflict (nonce) do nothing returning nonce",
    [nonce, new Date(Date.now() + NONCE_TTL_MS).toISOString()],
  );
  if (inserted.length === 0) {
    throw createError({ statusCode: 409, statusMessage: "این درخواست دوربین قبلاً دریافت شده است." });
  }
}
