import { createError, defineEventHandler, getHeader, setResponseHeader, type H3Event } from "h3";
import { authenticateDevice, configuredBootstrapToken } from "@/lib/phone-bridge-auth";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const deviceId = getHeader(event, "x-hirmand-device-id")?.trim().slice(0, 120) ?? "";
  if (deviceId) await authenticateDevice(event, deviceId);
  else {
    const bootstrap = configuredBootstrapToken();
    const auth = getHeader(event, "authorization") ?? "";
    if (!bootstrap || auth !== `Bearer ${bootstrap}`) {
      throw createError({ statusCode: 401, statusMessage: "احراز هویت Phone Bridge ناموفق است." });
    }
  }
  return {
    ok: true,
    service: "hirmand-phone-bridge",
    protocol: "hirmand.phone-bridge.v1",
  };
});
