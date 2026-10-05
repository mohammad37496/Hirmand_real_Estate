import { createError, defineEventHandler, getHeader, getRequestIP, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { enrollDevice } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { deviceInfoSchema } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

const bodySchema = z.object({ device: deviceInfoSchema });

function bearer(event: Parameters<typeof getHeader>[0]): string {
  const raw = getHeader(event, "authorization") ?? "";
  return /^Bearer\s+(.+)$/i.exec(raw.trim())?.[1]?.trim() ?? "";
}

/**
 * Enrollment — the one endpoint authenticated by the *bootstrap* credential.
 *
 * No HMAC here on purpose: the device does not have a device token yet, so there
 * is no key to sign with. The pairing token is single-use and is consumed in the
 * same statement that creates the device, so it cannot be replayed once spent.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const pairingToken = bearer(event);
  if (!pairingToken) {
    throw createError({ statusCode: 401, statusMessage: "کلید ثبت دستگاه ارسال نشده است." });
  }

  // Throttle by client IP, not by device: at this point no device exists yet.
  const limit = await consumePhoneBridgeAttempt("register", getRequestIP(event, { xForwardedFor: true }) ?? "unknown");
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تلاش ثبت دستگاه بیش از حد مجاز بوده است." });
  }

  const body = await readBody(event).catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !parsed.data.device.id) {
    throw createError({ statusCode: 422, statusMessage: "اطلاعات دستگاه معتبر نیست." });
  }

  if (dbSource === "unconfigured") {
    throw createError({
      statusCode: 503,
      statusMessage: "پایگاه دادهٔ Phone Bridge تنظیم نشده است.",
    });
  }

  const result = await enrollDevice({
    sql: await getSql(),
    pairingToken,
    device: parsed.data.device,
  });

  if (!result.ok) {
    await writePhoneBridgeAudit({
      deviceId: parsed.data.device.id,
      actor: "device",
      action: "device.register",
      result: "denied",
      ip: getRequestIP(event, { xForwardedFor: true }) ?? "",
      userAgent: getHeader(event, "user-agent") ?? "",
      detail: { reason: result.reason },
    });
    throw createError({
      statusCode: 401,
      statusMessage: "کلید ثبت دستگاه نامعتبر، منقضی یا مصرف‌شده است.",
    });
  }

  await writePhoneBridgeAudit({
    deviceId: parsed.data.device.id,
    actor: "device",
    action: "device.register",
    ip: getRequestIP(event, { xForwardedFor: true }) ?? "",
    userAgent: getHeader(event, "user-agent") ?? "",
    detail: { model: parsed.data.device.model, appVersion: parsed.data.device.appVersionName },
  });

  // The device token is returned exactly once. It is stored only as a sha256
  // hash server-side, so a lost token means re-enrollment, never retrieval.
  return { ok: true, deviceToken: result.deviceToken, deviceId: parsed.data.device.id };
});