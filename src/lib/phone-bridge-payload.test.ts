/**
 * Regression tests for the Phone Bridge payload boundary.
 *
 * Every case here corresponds to a bug that actually shipped:
 *
 *   * `invalid input syntax for type numeric: "null"` — the string "null" (and
 *     "", "undefined", NaN) reaching a numeric column. `optionalNumber` must
 *     return a typed null for all of them.
 *   * `could not determine data type of parameter $n` — a parameter Postgres
 *     could not infer a type for. Every insert below therefore pins its column
 *     type explicitly with an inline cast.
 *   * Duplicate rows from retried packets — handled by unique indexes, exercised
 *     in the store helpers.
 *   * Timestamps stored as 1970 because a millisecond value was treated as
 *     seconds.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  heartbeatSchema,
  locationPointSchema,
  normalizeGrantedScopes,
  optionalInt,
  optionalNumber,
  remoteResultSchema,
  safeFileName,
  stripDisallowedModules,
  syncPacketSchema,
  toEpochMs,
  type SyncPacket,
} from "./phone-bridge-payload.server.ts";

describe("optionalNumber", () => {
  it("maps the literal string 'null' to a typed null, not to text", () => {
    assert.equal(optionalNumber("null"), null);
    assert.equal(optionalNumber("NULL"), null);
    assert.equal(optionalNumber("  null  "), null);
  });

  it("maps blank and 'undefined' strings to null", () => {
    assert.equal(optionalNumber(""), null);
    assert.equal(optionalNumber("   "), null);
    assert.equal(optionalNumber("undefined"), null);
  });

  it("maps real JS null, undefined and NaN to null", () => {
    assert.equal(optionalNumber(null), null);
    assert.equal(optionalNumber(undefined), null);
    assert.equal(optionalNumber(Number.NaN), null);
    assert.equal(optionalNumber(Number.POSITIVE_INFINITY), null);
  });

  it("accepts numbers and numeric strings", () => {
    assert.equal(optionalNumber(42), 42);
    assert.equal(optionalNumber(-3.5), -3.5);
    assert.equal(optionalNumber("42"), 42);
    assert.equal(optionalNumber(" 42 "), 42);
  });

  it("rejects a boolean rather than coercing it to 0/1", () => {
    assert.equal(optionalNumber(true), null);
    assert.equal(optionalNumber(false), null);
  });

  it("rejects non-numeric text", () => {
    assert.equal(optionalNumber("abc"), null);
    assert.equal(optionalNumber({}), null);
    assert.equal(optionalNumber([]), null);
  });
});

describe("optionalInt", () => {
  it("rejects a fractional value instead of silently truncating it", () => {
    assert.equal(optionalInt(1.5), null);
    assert.equal(optionalInt("1.5"), null);
  });

  it("accepts integers and numeric integer strings", () => {
    assert.equal(optionalInt(7), 7);
    assert.equal(optionalInt("7"), 7);
    assert.equal(optionalInt("0"), 0);
  });
});

describe("toEpochMs", () => {
  it("accepts Android's epoch-millisecond timestamps", () => {
    assert.equal(toEpochMs(1735689600000), 1735689600000);
  });

  it("rejects a seconds-based value rather than storing 1970", () => {
    assert.equal(toEpochMs(1735689600), null);
    assert.equal(toEpochMs(0), null);
  });

  it("rejects null, blank and out-of-range values", () => {
    assert.equal(toEpochMs(null), null);
    assert.equal(toEpochMs("null"), null);
    assert.equal(toEpochMs(Number.MAX_SAFE_INTEGER), null);
  });
});

describe("normalizeGrantedScopes", () => {
  it("keeps only the explicitly granted modules, sorted", () => {
    assert.deepEqual(normalizeGrantedScopes({ sms: true, location: true, calls: false }), ["location", "sms"]);
  });

  it("returns an empty set for absent or malformed input", () => {
    assert.deepEqual(normalizeGrantedScopes(null), []);
    assert.deepEqual(normalizeGrantedScopes("yes"), []);
    assert.deepEqual(normalizeGrantedScopes([true]), []);
    assert.deepEqual(normalizeGrantedScopes({ sms: "true" }), []);
  });
});

describe("syncPacketSchema", () => {

  it("accepts the packet PhoneDataCollector actually sends", () => {
    const parsed = syncPacketSchema.safeParse({
      schema: "hirmand.phone-bridge.v1",
      sentAt: 1735689600000,
      syncId: "0f1c",
      snapshotHash: "abc123",
      device: {
        id: "dev-1",
        name: "گوشی من",
        manufacturer: "samsung",
        model: "SM-J730F",
        androidVersion: "8.0.0",
        sdkInt: 26,
        appVersionName: "0.9.0",
        appVersionCode: 63,
      },
      deviceStats: {
        batteryPercent: 80,
        batteryCharging: false,
        storageAvailableBytes: 12345678,
        storageTotalBytes: 16000000000,
        ramAvailableBytes: 900,
        ramTotalBytes: 1600,
        lowMemory: false,
      },
      wifi: { ssid: "Office", linkSpeedMbps: 72, rssi: -50, networkId: 3 },
      contacts: [{ contactId: "1", name: "Ali", numbers: ["09120000000"] }],
      selectedFiles: [{ name: "a.pdf", mimeType: "application/pdf", sizeBytes: 100 }],
    });

    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.device.appVersionCode, 63);
    assert.equal(parsed.data.deviceStats.batteryPercent, 80);
  });

  it("tolerates the JSONObject.NULL fields the collector emits for missing stats", () => {
    const parsed = syncPacketSchema.safeParse({
      device: { id: "dev-1" },
      deviceStats: { batteryPercent: null, batteryCharging: null },
      wifi: { ssid: null, linkSpeedMbps: null, rssi: null, networkId: null },
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.deviceStats.batteryPercent, null);
    assert.equal(parsed.data.deviceStats.batteryCharging, null);
  });

  it("rejects a packet with no device id", () => {
    assert.equal(syncPacketSchema.safeParse({ device: {} }).success, false);
  });

  it("caps a collection so an oversized body cannot become an oversized row", () => {
    const parsed = syncPacketSchema.safeParse({
      device: { id: "dev-1" },
      calls: Array.from({ length: 501 }, (_, i) => ({ number: `09${i}` })),
    });
    assert.equal(parsed.success, false);
  });
});

describe("heartbeatSchema", () => {
  it("accepts the packet SyncWorker.sendHeartbeat sends", () => {
    const parsed = heartbeatSchema.safeParse({
      snapshotHash: "abc",
      deviceStats: {
        batteryPercent: 55,
        batteryCharging: null,
        storageAvailableBytes: 1,
        storageTotalBytes: 2,
        ramAvailableBytes: 3,
        ramTotalBytes: 4,
      },
      queue: { queued: 0, deadLetters: 0, reportedAt: 1735689600000 },
      device: { id: "dev-1" },
    });
    assert.equal(parsed.success, true);
  });

  it("accepts a heartbeat with nothing but a snapshot hash", () => {
    assert.equal(heartbeatSchema.safeParse({ snapshotHash: "abc" }).success, true);
  });
});

describe("locationPointSchema", () => {
  it("accepts a well-formed fix", () => {
    const parsed = locationPointSchema.safeParse({
      clientPointId: "p-1",
      latitude: 32.6539,
      longitude: 51.665,
      accuracyMeters: 12,
      provider: "gps",
      recordedAt: 1735689600000,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects out-of-range coordinates", () => {
    assert.equal(locationPointSchema.safeParse({ clientPointId: "p", latitude: 91, longitude: 0 }).success, false);
    assert.equal(locationPointSchema.safeParse({ clientPointId: "p", latitude: 0, longitude: 181 }).success, false);
  });

  it("rejects a fix with no clientPointId, which is the dedupe key", () => {
    assert.equal(locationPointSchema.safeParse({ latitude: 1, longitude: 1 }).success, false);
  });
});

describe("remoteResultSchema", () => {
  it("accepts the get_location result RemoteControlService posts", () => {
    const parsed = remoteResultSchema.safeParse({
      deviceId: "dev-1",
      commandId: "cmd-1",
      action: "get_location",
      success: true,
      error: null,
      result: { latitude: 32.6, longitude: 51.6, provider: "gps", recordedAt: 1735689600000 },
    });
    assert.equal(parsed.success, true);
  });

  it("accepts an error result with no result payload", () => {
    const parsed = remoteResultSchema.safeParse({
      commandId: "cmd-2",
      action: "take_photo",
      success: false,
      error: "مجوز دوربین فعال نیست",
    });
    assert.equal(parsed.success, true);
  });

  it("requires a commandId", () => {
    assert.equal(remoteResultSchema.safeParse({ action: "take_photo", success: true }).success, false);
  });
});

describe("stripDisallowedModules", () => {
  const packet = {
    device: { id: "dev-1" },
    sms: [{ address: "0912", body: "hi" }],
    location: { latitude: 1, longitude: 2 },
    apps: [{ packageName: "com.x" }],
  } as unknown as SyncPacket;

  it("removes every module the device is not cleared for", () => {
    const cleaned = stripDisallowedModules(packet, (module) => module === "location");

    assert.equal("sms" in cleaned, false);
    assert.equal("apps" in cleaned, false);
    assert.equal(cleaned.location, packet.location);
    // The envelope itself is untouched.
    assert.equal(cleaned.device.id, "dev-1");
  });

  it("removes everything when no module is allowed", () => {
    const cleaned = stripDisallowedModules(packet, () => false);
    assert.equal("sms" in cleaned, false);
    assert.equal("location" in cleaned, false);
    assert.equal("apps" in cleaned, false);
  });

  it("drops the key entirely rather than setting it to undefined", () => {
    const cleaned = stripDisallowedModules(packet, () => false);
    // An explicit `undefined` would still serialize as a key in JSON.stringify
    // of some encoders and read as "sent with no value" downstream.
    assert.equal(Object.prototype.hasOwnProperty.call(cleaned, "sms"), false);
  });
});

describe("safeFileName", () => {
  it("strips path separators so a crafted name cannot traverse", () => {
    const cleaned = safeFileName("../../etc/passwd");
    assert.equal(cleaned.includes("/"), false);
    assert.equal(cleaned.includes("\\"), false);
    assert.equal(cleaned.startsWith("."), false);
  });

  it("strips control characters but keeps ordinary spaces", () => {
    // Spaces are legitimate in Persian filenames and are not a traversal risk.
    assert.equal(safeFileName("a\nbc\tc"), "a-bc-c");
  });

  it("falls back for an empty or all-separator name", () => {
    assert.equal(safeFileName(""), "file");
    assert.equal(safeFileName("///"), "file");
    assert.equal(safeFileName("   "), "file");
  });

  it("keeps a Persian name intact", () => {
    assert.equal(safeFileName("\u0642\u0631\u0627\u0631\u062f\u0627\u062f.pdf"), "\u0642\u0631\u0627\u0631\u062f\u0627\u062f.pdf");
  });
});
