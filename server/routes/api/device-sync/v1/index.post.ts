import { createError, defineEventHandler, setResponseHeader } from "h3";
import { authenticateSignedRequest, computeEffectiveAccess } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { normalizePhoneBridgePolicy } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

/**
 * The signed sync packet (`POST /api/device-sync/v1`).
 *
 * Three gates apply here, in this order:
 *   1. HMAC + replay (authenticateSignedRequest)
 *   2. Rate limit
 *   3. Consent ∩ policy — any module the device is not cleared for is stripped
 *      from the payload *before* it is persisted, so un-authorised data never
 *      reaches a row even if a modified client sent it.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("sync", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد درخواست‌های همگام‌سازی بیش از حد مجاز است." });
  }

  const payload = auth.payload ?? {};
  const cleanedModules = normalizePhoneBridgePolicy(payload);
  const removedModules = Object.keys(payload).filter(
    (key) => !key.startsWith("_") && key !== "device" && key !== "sentAt" && key !== "syncId" && key !== "schema" && !cleanedModules[key as keyof typeof cleanedModules],
  );

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "device.sync",
    module: removedModules.join(",") || "base",
    result: "ok",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: {
      removedModules,
    },
  });

  return {
    ok: true,
    effectiveModules: auth.allowedModules,
  };
});