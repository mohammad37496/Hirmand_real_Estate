import { createError, defineEventHandler, getHeader, setResponseHeader } from "h3";
import { authenticateSignedRequest, computeEffectiveAccess, assertModuleAllowed, readSignedBody } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { msToIso, safeFileName, toEpochMs } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Call-recording upload (`POST /api/device-sync/v1/call-recordings`).
 *
 * Same integrity rules as `/files` (declared hash must match the bytes, declared
 * size must match the body), plus the `call_recording` consent + policy gate —
 * this is the most sensitive payload the app can send, so it gets its own module
 * rather than riding along with `selected_files`.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("files", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد ارسال ضبط تماس بیش از حد مجاز است." });
  }

  const access = await computeEffectiveAccess(auth.device, auth.sql);
  assertModuleAllowed(access, "call_recording");

  const bytes = Buffer.from(await readSignedBody(event));

  const sha256 = (getHeader(event, "x-hirmand-file-sha256") ?? "").trim().toLowerCase();
  const sizeHeader = (getHeader(event, "x-hirmand-file-size") ?? "").trim();
  const mimeType = (getHeader(event, "x-hirmand-file-mime") ?? "audio/mp4").slice(0, 180);
  const direction = (getHeader(event, "x-hirmand-call-direction") ?? "unknown").slice(0, 20);
  const durationHeader = Number((getHeader(event, "x-hirmand-call-duration") ?? "0").trim());

  if (!SHA256_HEX.test(sha256)) {
    throw createError({ statusCode: 400, statusMessage: "شناسهٔ sha256 ضبط معتبر نیست." });
  }

  const declaredSize = Number(sizeHeader);
  if (!Number.isInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_AUDIO_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "اندازهٔ ضبط معتبر نیست." });
  }
  if (bytes.length !== declaredSize) {
    throw createError({ statusCode: 400, statusMessage: "اندازهٔ ضبط با محتوای ارسالی هم‌خوانی ندارد." });
  }

  const { createHash } = await import("node:crypto");
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) {
    throw createError({ statusCode: 400, statusMessage: "محتوای ضبط با sha256 اعلام‌شده هم‌خوانی ندارد." });
  }

  const startedAtMs = toEpochMs(getHeader(event, "x-hirmand-call-started-at"));
  const endedAtMs = toEpochMs(getHeader(event, "x-hirmand-call-ended-at"));
  const durationSeconds =
    Number.isFinite(durationHeader) && durationHeader > 0 ? Math.trunc(durationHeader) : null;
  const name = safeFileName(`call-${sha256.slice(0, 12)}`);

  const existing = await auth.sql.query<{ id: string }>(
    "select id from phone_bridge_files where device_id = $1 and kind = 'call_recording' and sha256 = $2 limit 1",
    [auth.device.id, sha256],
  );

  if (existing[0]) {
    return { ok: true, stored: false, deduplicated: true, fileId: sha256, deviceId: auth.device.id };
  }

  await auth.sql.query(
    `insert into phone_bridge_files
       (id, device_id, file_id, name, mime_type, size_bytes, sha256, kind,
        call_started_at, call_ended_at, call_direction, call_duration_seconds)
     values ($1,$2,$3,$4,$5,$6,$7,'call_recording',$8::timestamptz,$9::timestamptz,$10,$11)
     on conflict (device_id, kind, sha256) do nothing`,
    [
      crypto.randomUUID(),
      auth.device.id,
      `${auth.device.id}:${sha256}`,
      name,
      mimeType,
      bytes.length,
      sha256,
      msToIso(startedAtMs),
      msToIso(endedAtMs),
      direction,
      durationSeconds,
    ],
  );

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "call_recording.upload",
    module: "call_recording",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: { direction, durationSeconds, sizeBytes: bytes.length, sha256 },
  });

  return {
    ok: true,
    stored: true,
    deduplicated: false,
    fileId: sha256,
    deviceId: auth.device.id,
  };
});