import { describe, expect, it } from "vitest";
import {
  getMobilePresence,
  managementModeLabel,
  parseManagementMode,
  permissionHealthFromPayload,
} from "@/lib/mobile-management";

describe("mobile-management helpers", () => {
  const now = Date.parse("2026-10-06T00:00:00.000Z");

  it("keeps presence thresholds consistent", () => {
    expect(getMobilePresence(new Date(now - 4 * 60 * 1000).toISOString(), now)).toBe("online");
    expect(getMobilePresence(new Date(now - 30 * 60 * 1000).toISOString(), now)).toBe("stale");
    expect(getMobilePresence(new Date(now - 2 * 60 * 60 * 1000).toISOString(), now)).toBe("offline");
    expect(getMobilePresence(null, now)).toBe("unknown");
  });

  it("normalizes management modes without trusting unknown values", () => {
    expect(parseManagementMode("device_owner")).toBe("device_owner");
    expect(parseManagementMode("profile_owner")).toBe("profile_owner");
    expect(parseManagementMode("not-real")).toBe("unknown");
    expect(managementModeLabel("device_owner")).toBe("مدیریت کامل سازمانی");
  });

  it("maps permission telemetry to explicit health states", () => {
    expect(
      permissionHealthFromPayload({
        location: true,
        camera: false,
        microphone: "unknown",
      }),
    ).toEqual([
      { key: "location", label: "موقعیت مکانی", status: "granted" },
      { key: "camera", label: "دوربین", status: "denied" },
      { key: "microphone", label: "میکروفون", status: "unknown" },
      { key: "notifications", label: "اعلان‌ها", status: "unknown" },
      { key: "accessibility", label: "دسترسی دسترس‌پذیری", status: "unknown" },
      { key: "usageAccess", label: "دسترسی مصرف برنامه", status: "unknown" },
    ]);
  });
});
