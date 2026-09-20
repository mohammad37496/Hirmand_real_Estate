import {
  createError,
  defineEventHandler,
  getCookie,
  readBody,
  setCookie,
  setResponseHeader,
} from "h3";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isAdminKeyValid,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";

type Body = {
  action?: "login" | "logout";
  adminKey?: string;
};

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = (await readBody(event).catch(() => ({}))) as Body;
  const action = body.action ?? "login";

  if (action === "logout") {
    setCookie(event, ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      path: "/",
      maxAge: 0,
    });
    return { success: true };
  }

  const existing = await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE));
  if (existing) return { success: true, authenticated: true };

  if (!isAdminKeyValid(body.adminKey)) {
    throw createError({
      statusCode: 401,
      statusMessage: "کلید مدیریت نادرست است.",
    });
  }

  const token = await createAdminSessionToken();
  setCookie(event, ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return { success: true, authenticated: true };
});
