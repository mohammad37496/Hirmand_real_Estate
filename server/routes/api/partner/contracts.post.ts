import { createError, defineEventHandler, getCookie, readBody } from "h3";
import { PARTNER_SESSION_COOKIE, verifyPartnerSessionToken } from "@/lib/partner-session.server";
import {
  getPartnerOverview,
  submitPartnerContract,
} from "@/lib/partner-program.server";

export default defineEventHandler(async (event) => {
  const partnerId = await verifyPartnerSessionToken(getCookie(event, PARTNER_SESSION_COOKIE));
  if (!partnerId) {
    throw createError({ statusCode: 401, statusMessage: "نشست همکار معتبر نیست. دوباره وارد شوید." });
  }

  const body = (await readBody(event).catch(() => ({}))) as {
    action?: "list" | "create";
    contractReference?: string;
    clientName?: string;
    transactionType?: "buy" | "sell" | "rent" | "mortgage";
    note?: string;
  };

  if (body.action === "list" || !body.action) {
    const partner = await getPartnerOverview(partnerId);
    if (!partner) throw createError({ statusCode: 404, statusMessage: "حساب همکار پیدا نشد." });
    return { partner };
  }

  if (!body.transactionType) {
    throw createError({ statusCode: 400, statusMessage: "نوع قرارداد را انتخاب کنید." });
  }

  try {
    const contract = await submitPartnerContract({
      partnerId,
      contractReference: body.contractReference,
      clientName: body.clientName,
      transactionType: body.transactionType,
      note: body.note,
    });
    return { success: true, contract };
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : "ثبت قرارداد انجام نشد.",
    });
  }
});
