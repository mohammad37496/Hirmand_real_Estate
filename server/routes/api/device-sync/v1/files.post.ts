import { createError, defineEventHandler, getHeader, setResponseHeader } from "h3";
import { authenticateSignedRequest, computeEffectiveAccess, assertModuleAllowed, readSignedBody } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { safeFileName } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Selected-files upload (`POST /api/device-sync/v1/files`).
 *
 * The device sends the bytes as the request body and the metadata as headers,
 * matching `SyncWorker.uploadSelectedFiles`. Three things are enforced here that
 * the device cannot be trusted to enforce:
 *
 *   * The declared sha256 must match the received bytes. Without this a device
 *     could register one hash and deliver different content.
 *   * The declared size must match the body length, so a truncated transfer is a
 *     clean 400 rather than a silently truncated file.
 *   * The filename is base64-decoded and sanitised before it is stored, so a name
 *     containing `../` cannot traverse anything when the file is later served.
 *
 * Bytes are content-addressed on `(device_id, kind, sha256)`, so re-uploading an
 * unchanged file is a no-op that reports `deduplicated: true`.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("files", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد ارسال فایل بیش از حد مجاز است." });
  }

  const access = await computeEffectiveAccess(auth.device, auth.sql);
  assertModuleAllowed(access, "selected_files");

  const bytes = Buffer.from(await readSignedBody(event));

  const encodedName = (getHeader(event, "x-hirmand-file-name") ?? "").trim();
  const sha256 = (getHeader(event, "x-hirmand-file-sha256") ?? "").trim().toLowerCase();
  const sizeHeader = (getHeader(event, "x-hirmand-file-size") ?? "").trim();
  const mimeType = (getHeader(event, "x-hirmand-file-mime") ?? "application/octet-stream").slice(0, 180);

  if (!SHA256_HEX.test(sha256)) {
    throw createError({ statusCode: 400, statusMessage: "شناسهٔ sha256 فایل معتبر نیست." });
  }

  const declaredSize = Number(sizeHeader);
  if (!Number.isInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_FILE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "اندازهٔ فایل معتبر نیست." });
  }
  if (bytes.length !== declaredSize) {
    throw createError({ statusCode: 400, statusMessage: "اندازهٔ فایل با محتوای ارسالی هم‌خوانی ندارد." });
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "حجم فایل بیش از حد مجاز است." });
  }

  const { createHash } = await import("node:crypto");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) {
    throw createError({ statusCode: 400, statusMessage: "محتوای فایل با sha256 اعلام‌شده هم‌خوانی ندارد." });
  }

  const name = safeFileName(decodeFileName(encodedName));

  const existing = await auth.sql.query<{ id: string }>(
    "select id from phone_bridge_files where device_id = $1 and kind = 'selected' and sha256 = $2 limit 1",
    [auth.device.id, sha256],
  );

  if (existing[0]) {
    return {
      ok: true,
      stored: false,
      deduplicated: true,
      fileId: sha256,
      deviceId: auth.device.id,
      name,
      sizeBytes: bytes.length,
      mimeType,
      sha256,
    };
  }

  const fileId = `${auth.device.id}:${sha256}`;
  await auth.sql.query(
    `insert into phone_bridge_files
       (id, device_id, file_id, name, mime_type, size_bytes, sha256, kind)
     values ($1,$2,$3,$4,$5,$6,$7,'selected')
     on conflict (device_id, kind, sha256) do nothing`,
    [crypto.randomUUID(), auth.device.id, fileId, name, mimeType, bytes.length, sha256],
  );

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "file.upload",
    module: "selected_files",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: { name, sizeBytes: bytes.length, sha256 },
  });

  return {
    ok: true,
    stored: true,
    deduplicated: false,
    fileId: sha256,
    deviceId: auth.device.id,
    name,
    sizeBytes: bytes.length,
    mimeType,
    sha256,
  };
});

/**
 * Mirrors `decodeFileName` in android/server/device-sync.mjs: the name travels
 * base64-encoded so non-ASCII Persian names survive an HTTP header.
 */
function decodeFileName(encoded: string): string {
  if (!encoded) return "file";
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return "file";
  }
}