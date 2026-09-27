import { defineEventHandler, setResponseHeader } from "h3";

export default defineEventHandler((event) => {
  setResponseHeader(event, "x-content-type-options", "nosniff");
  setResponseHeader(event, "referrer-policy", "strict-origin-when-cross-origin");
  setResponseHeader(event, "permissions-policy", "camera=(), microphone=(), geolocation=()");
  setResponseHeader(event, "x-frame-options", "SAMEORIGIN");
  setResponseHeader(event, "x-permitted-cross-domain-policies", "none");

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    setResponseHeader(
      event,
      "strict-transport-security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
});
