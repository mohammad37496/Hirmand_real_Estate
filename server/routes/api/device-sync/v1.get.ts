import { createError, defineEventHandler, getHeader, setResponseHeader, type H3Event } from "h3";

function configuredToken() {
  return process.env.HIRMAND_PHONE_BRIDGE_TOKEN?.trim() || process.env.PHONE_BRIDGE_SYNC_TOKEN?.trim() || "";
}

function assertAuthorized(event: H3Event) {
  const token = configuredToken();
  if (!token) {
    throw createError({ statusCode: 503, statusMessage: "کلید Phone Bridge روی سرور تنظیم نشده است." });
  }
  const auth = getHeader(event, "authorization") ?? "";
  if (auth !== `Bearer ${token}`) {
    throw createError({ statusCode: 401, statusMessage: "احراز هویت Phone Bridge ناموفق است." });
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  assertAuthorized(event);
  return {
    ok: true,
    service: "hirmand-phone-bridge",
    protocol: "hirmand.phone-bridge.v1",
  };
});
