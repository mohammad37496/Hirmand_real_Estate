/**
 * Payload parsing for the Phone Bridge sync inbox.
 *
 * Every value that reaches SQL goes through this module first, and the rules
 * below exist because of specific past failures:
 *
 *   * `optionalNumber` maps "null" / "" / undefined / NaN to a real JS `null`,
 *     never to the string "null". That string is what produced
 *     `invalid input syntax for type numeric: "null"`.
 *   * `optionalInt` never returns a float, so an integer column cannot be handed
 *     1.5 and fail at execute time.
 *   * `toEpochMs` accepts epoch ms only. Android sends milliseconds; anything
 *     below this threshold is a seconds value and is rejected rather than being
 *     stored as 1970.
 *   * Arrays are length-capped and strings are length-capped *before* insert, so
 *     a 5 MB body cannot be amplified into a 5 MB row.
 *
 * The field names are the wire contract with the Kotlin side and must not drift;
 * `phone-bridge-payload.test.ts` pins them.
 */

import { z } from "zod";

/** Every collection the app is allowed to send in one packet. */
export const MAX_COLLECTION_ITEMS = 500;

const shortText = (max: number) => z.string().trim().max(max);

/**
 * Optional numeric coercion shared by every numeric field.
 *
 * Returns `null` (a typed Postgres NULL) for absent / blank / "null" / NaN
 * rather than letting any of those reach a numeric column as text.
 */
export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Same as {@link optionalNumber} but rejects anything with a fractional part. */
export function optionalInt(value: unknown): number | null {
  const parsed = optionalNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

/** Required finite number, or `fallback` when the input is unusable. */
export function requiredNumber(value: unknown, fallback: number): number {
  const parsed = optionalNumber(value);
  return parsed === null ? fallback : parsed;
}

/**
 * Normalizes an Android timestamp to epoch milliseconds.
 *
 * Android writes `System.currentTimeMillis()`, so anything below 1e12 is a
 * seconds-based value by mistake. Rejecting it keeps a wrong-unit timestamp
 * from landing in the `recorded_at` column as 1970 instead of surfacing the bug.
 */
export function toEpochMs(value: unknown): number | null {
  const parsed = optionalNumber(value);
  if (parsed === null || parsed <= 0) return null;
  if (parsed < 1_000_000_000_000) return null;
  // Beyond year ~33658 is certainly garbage; keep the column in a sane range.
  if (parsed > 32_503_680_000_000) return null;
  return Math.trunc(parsed);
}

export function msToIso(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

/**
 * Zod wrappers around the coercers above.
 *
 * `z.any().optional().transform(...)` rather than `z.unknown()`: in zod v4 an
 * object key declared as `z.unknown()` or `z.any()` is still *required*, so a
 * payload that legitimately omits the field is rejected. The `.optional()` lets
 * an absent key through while the transform still runs, turning it into a typed
 * `null` — exactly what the nullable column wants, so a route can never
 * accidentally pass `undefined` to a parameter Postgres cannot infer a type for.
 */
const numberField = z.any().optional().transform((value) => optionalNumber(value));
const intField = z.any().optional().transform((value) => optionalInt(value));

/**
 * Exported so other server routes coerce query/body numbers the same way instead
 * of passing raw `unknown` into a numeric column.
 */
export const optionalIntField = intField;

const EMPTY_DEVICE_STATS = {
  batteryPercent: null,
  batteryCharging: null,
  storageAvailableBytes: null,
  storageTotalBytes: null,
  ramAvailableBytes: null,
  ramTotalBytes: null,
};

const EMPTY_QUEUE_STATS = { queued: null, deadLetters: null, reportedAt: null };

/** A JSON object whose keys are module ids and whose values are booleans. */
export const booleanScopeMap = z.record(z.string(), z.boolean());

/** Coerces an unknown scope map into a clean `{ module: true }` set. */
export function normalizeGrantedScopes(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, granted]) => granted === true)
    .map(([module]) => module)
    .sort();
}

export const deviceInfoSchema = z.object({
  id: shortText(120),
  name: shortText(120).optional().default(""),
  manufacturer: shortText(80).optional().default(""),
  model: shortText(80).optional().default(""),
  androidVersion: shortText(40).optional().default(""),
  sdkInt: intField,
  appVersionName: shortText(40).optional().default(""),
  appVersionCode: intField,
});

export const deviceStatsSchema = z.object({
  batteryPercent: intField,
  batteryCharging: z.boolean().nullable().optional().default(null),
  storageAvailableBytes: intField,
  storageTotalBytes: intField,
  ramAvailableBytes: intField,
  ramTotalBytes: intField,
});

/**
 * Device stats as a route can use them: absent or explicit `null` becomes the
 * fully-null shape, so callers never re-check for `null` before reading a field.
 * Android emits `JSONObject.NULL` for stats it could not read, which is why
 * `null` is accepted here and not just "missing".
 */
const deviceStatsField = z
  .union([deviceStatsSchema, z.literal(null)])
  .optional()
  .transform((value) => value ?? EMPTY_DEVICE_STATS);

export const heartbeatSchema = z.object({
  snapshotHash: shortText(80).optional().default(""),
  deviceStats: deviceStatsField,
  queue: z
    .object({ queued: intField, deadLetters: intField, reportedAt: intField })
    .optional()
    .transform((value) => value ?? EMPTY_QUEUE_STATS),
  device: z
    .object({ id: shortText(120) })
    .optional()
    .transform((value) => value ?? { id: "" }),
});

export const locationPointSchema = z.object({
  clientPointId: shortText(120).min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: numberField,
  altitudeMeters: numberField,
  speedMps: numberField,
  bearingDegrees: numberField,
  provider: shortText(40).optional().default("gps"),
  recordedAt: intField,
  timestamp: intField,
});

export const syncPacketSchema = z.object({
  schema: shortText(60).optional().default(""),
  sentAt: intField,
  syncId: shortText(120).optional().default(""),
  snapshotHash: shortText(80).optional().default(""),
  device: deviceInfoSchema,
  deviceStats: deviceStatsField,
  wifi: z
    .object({
      ssid: z.string().max(120).nullable().optional(),
      linkSpeedMbps: intField,
      rssi: intField,
      networkId: intField,
    })
    .nullable()
    .optional(),
  location: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      accuracyMeters: numberField,
      timestamp: intField,
    })
    .nullable()
    .optional(),
  contacts: z.array(z.unknown()).max(MAX_COLLECTION_ITEMS).optional(),
  calls: z.array(z.unknown()).max(MAX_COLLECTION_ITEMS).optional(),
  sms: z.array(z.unknown()).max(MAX_COLLECTION_ITEMS).optional(),
  calendar: z.array(z.unknown()).max(MAX_COLLECTION_ITEMS).optional(),
  apps: z.array(z.unknown()).max(MAX_COLLECTION_ITEMS).optional(),
  selectedFiles: z.array(z.unknown()).max(100).optional(),
});

export const remoteResultSchema = z.object({
  deviceId: shortText(120).optional().default(""),
  commandId: shortText(120).min(1),
  action: shortText(60).min(1),
  success: z.boolean(),
  error: z.string().max(500).nullable().optional(),
  result: z.record(z.string(), z.unknown()).optional().default({}),
});

export type SyncPacket = z.infer<typeof syncPacketSchema>;
export type Heartbeat = z.infer<typeof heartbeatSchema>;
export type LocationPoint = z.infer<typeof locationPointSchema>;
export type RemoteResult = z.infer<typeof remoteResultSchema>;
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

/**
 * Modules the sync packet may carry, mapped to the payload key that holds them.
 *
 * A module is written only when consent, server policy and the device switch
 * all allow it. Anything not listed here is dropped at this boundary, so
 * un-authorised data never reaches a payload or a row.
 */
export const SYNC_MODULES = [
  "wifi",
  "location",
  "contacts",
  "calls",
  "sms",
  "calendar",
  "apps",
] as const;

export type SyncModule = (typeof SYNC_MODULES)[number];

/**
 * Strips every module the device is not allowed to send.
 *
 * Runs at the payload boundary rather than in the route, so there is exactly one
 * place where "what may be transmitted" is decided.
 */
export function stripDisallowedModules(
  packet: SyncPacket,
  isAllowed: (module: SyncModule) => boolean,
): SyncPacket {
  const next: SyncPacket = { ...packet };
  for (const module of SYNC_MODULES) {
    if (isAllowed(module)) continue;
    // `delete` rather than `= undefined`: a key present with an undefined value
    // still serializes, and "absent" is what the payload contract means.
    delete next[module];
  }
  return next;
}

/**
 * Normalizes a client-supplied filename before it is stored or served.
 *
 * Path separators and control characters collapse to a dash, so a crafted name
 * cannot traverse a directory; leading dots and dashes are stripped so the result
 * is never a dotfile or a bare separator. A name that sanitizes down to nothing
 * useful falls back to `"file"` rather than becoming an empty or `-` name.
 */
export function safeFileName(value: string): string {
  const cleaned = value
    // Matching control characters is the entire point of this sanitizer, so the
    // no-control-regex rule is inverted here rather than worked around by
    // splitting the range into a lookup table.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/\x00-\x1f\x7f]+/g, "-")
    .replace(/^[.\-\s]+/, "")
    .slice(-160);

  // A name of only dashes/spaces (e.g. "///") is not a usable filename.
  return /[-\s]/.test(cleaned) && !/[^-\s]/.test(cleaned) ? "file" : cleaned || "file";
}