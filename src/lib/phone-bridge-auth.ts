import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";
import { getSql } from "@/lib/db";

const TOKEN_KEYS = ["HIRMAND_PHONE_BRIDGE_TOKEN", "PHONE_BRIDGE_SYNC_TOKEN"] as const;

export const PHONE_BRIDGE_MODULES = [
  "location",
  "wifi",
  "contacts",
  "calls",
  "sms",
  "calendar",
  "apps",
  "camera",
  "microphone",
  "selectedFiles",
] as const;

export type PhoneBridgeModule = typeof PHONE_BRIDGE_MODULES[number];
export type PhoneBridgeModulePolicy = Record<PhoneBridgeModule, boolean>;

export function normalizePhoneBridgePolicy(value: unknown): PhoneBridgeModulePolicy {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    PHONE_BRIDGE_MODULES.map((module) => [module, raw[module] !== false]),
  ) as PhoneBridgeModulePolicy;
}

export function configuredBootstrapToken() {
  for (const key of TOKEN_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function generateDeviceToken() {
  return "hpb_" + randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(event: H3Event) {
  const auth = getHeader(event, "authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function authenticateDevice(event: H3Event, deviceId: string) {
  const supplied = bearer(event);
  const bootstrap = configuredBootstrapToken();
  if (!supplied) throw createError({ statusCode: 401, statusMessage: "توکن Phone Bridge ارسال نشده است." });
  if (!bootstrap) throw createError({ statusCode: 503, statusMessage: "کلید Phone Bridge روی سرور تنظیم نشده است." });

  const sql = await getSql();
  const rows = await sql.query<{ token_hash: string | null; enabled: boolean; allowed_modules: unknown }>(
    `select token_hash,enabled,allowed_modules from phone_bridge_devices where id=$1 limit 1`,
    [deviceId],
  );
  const row = rows[0];

  // Bootstrap is only a compatibility/enrollment credential. Once a device
  // has a per-device token, Bootstrap can no longer bypass its revocation.
  if (!row || !row.token_hash) {
    if (sameSecret(supplied, bootstrap)) return { mode: "bootstrap" as const, deviceId, allowedModules: normalizePhoneBridgePolicy(row?.allowed_modules) };
    throw createError({ statusCode: 401, statusMessage: "توکن دستگاه معتبر نیست." });
  }

  if (!row.enabled) {
    throw createError({ statusCode: 401, statusMessage: "این دستگاه در پنل هیرمند غیرفعال شده است." });
  }

  if (!sameSecret(hashToken(supplied), row.token_hash)) {
    throw createError({ statusCode: 401, statusMessage: "توکن دستگاه معتبر نیست." });
  }

  await sql.query(
    `update phone_bridge_devices set last_authenticated_at=current_timestamp where id=$1`,
    [deviceId],
  );
  return { mode: "device" as const, deviceId, allowedModules: normalizePhoneBridgePolicy(row.allowed_modules) };
}

export function requireBootstrap(event: H3Event) {
  const supplied = bearer(event);
  const bootstrap = configuredBootstrapToken();
  if (!bootstrap) throw createError({ statusCode: 503, statusMessage: "کلید ثبت Phone Bridge روی سرور تنظیم نشده است." });
  if (!supplied || !sameSecret(supplied, bootstrap)) {
    throw createError({ statusCode: 401, statusMessage: "کلید ثبت دستگاه معتبر نیست." });
  }
}
