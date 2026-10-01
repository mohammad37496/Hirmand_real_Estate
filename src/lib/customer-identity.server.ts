import { getCookie, setCookie, type H3Event } from "h3";
import { auth } from "@/lib/auth/server";

const COOKIE_NAME = "hirmand_visitor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function validVisitorId(value: string | undefined) {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}

function requestHeaders(event: H3Event) {
  const headers = new Headers();
  const source = event.node?.req?.headers ?? {};
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    if (Array.isArray(value)) headers.set(key, value.join(","));
    else headers.set(key, String(value));
  }
  return headers;
}

export async function getCustomerIdentity(event: H3Event) {
  let visitorId: string = getCookie(event, COOKIE_NAME) ?? "";
  if (!validVisitorId(visitorId)) {
    visitorId = crypto.randomUUID();
    setCookie(event, COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: requestHeaders(event) });
    userId = session?.user?.id ? String(session.user.id) : null;
  } catch {
    // Anonymous visitor is a supported state.
  }

  return { visitorId, userId, authenticated: Boolean(userId) };
}
