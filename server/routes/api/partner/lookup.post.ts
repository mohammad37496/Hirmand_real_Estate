import { createError, defineEventHandler, readBody } from "h3";
import { lookupPartnerContract } from "@/lib/partner-program.server";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as { trackingCode?: string };
  const code = (body.trackingCode ?? "").trim();
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: "کد رهگیری را وارد کنید." });
  }
  const result = await lookupPartnerContract(code);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "کد رهگیری پیدا نشد." });
  }
  return result;
});
