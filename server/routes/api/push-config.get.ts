import { defineEventHandler, setResponseHeader } from "h3";

export default defineEventHandler((event) => {
  setResponseHeader(event, "cache-control", "public, max-age=300");
  const publicKey = String(process.env.VAPID_PUBLIC_KEY ?? "").trim();
  return {
    configured: Boolean(publicKey),
    publicKey: publicKey || null,
  };
});
