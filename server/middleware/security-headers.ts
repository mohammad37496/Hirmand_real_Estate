import { defineEventHandler, setResponseHeader } from "h3";

export default defineEventHandler((event) => {
  setResponseHeader(event, "x-content-type-options", "nosniff");
  setResponseHeader(event, "referrer-policy", "strict-origin-when-cross-origin");
  setResponseHeader(event, "permissions-policy", "camera=(), microphone=(), geolocation=()");
  setResponseHeader(event, "x-frame-options", "SAMEORIGIN");
});
