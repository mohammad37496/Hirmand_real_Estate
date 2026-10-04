import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{2,120}$/;

export const mobileRegistrationSchema = z.object({
  action: z.literal("register"),
  deviceId: z.string().trim().regex(DEVICE_ID_PATTERN),
  platform: z.enum(["android", "ios", "web"]).default("android"),
  appVersion: z.string().trim().max(80).optional().default(""),
  deviceModel: z.string().trim().max(160).optional().default(""),
  osVersion: z.string().trim().max(120).optional().default(""),
  deviceLabel: z.string().trim().max(120).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const mobileEventSchema = z.object({
  clientEventId: z.string().trim().min(1).max(180),
  eventType: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/),
  occurredAt: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const mobileSyncSchema = z.object({
  action: z.literal("sync"),
  events: z.array(mobileEventSchema).min(1).max(100),
});

export type MobileRegistration = z.infer<typeof mobileRegistrationSchema>;
export type MobileSync = z.infer<typeof mobileSyncSchema>;

const MAX_JSON_BYTES = 16 * 1024;

export function assertMobilePayloadSize(value: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
  if (bytes > MAX_JSON_BYTES) {
    throw new Error("حجم داده یک رویداد بیشتر از حد مجاز است.");
  }
}

export function generateMobileAccessToken(): string {
  return "hmdev_" + randomBytes(32).toString("base64url");
}

export function hashMobileAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readBearerToken(authorization: string | undefined): string | null {
  const value = String(authorization ?? "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}
