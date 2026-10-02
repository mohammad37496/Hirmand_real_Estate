import { createHash, randomUUID } from "node:crypto";
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
  getAdminSessionClaims,
  isAdminKeyValid,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";
import { dbSource, getSql } from "@/lib/db";
import {
  assertSameOrigin,
  clearAdminAttempts,
  clientFingerprint,
  consumeAdminAttempt,
  tooManyAttemptsError,
} from "@/lib/admin-rate-limit.server";

type Body = {
  action?: "login" | "logout";
  adminKey?: string;
};

const secureCookie = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const body = (await readBody(event).catch(() => ({}))) as Body;
  const action = body.action ?? "login";

  assertSameOrigin(event);

  if (action === "logout") {
    const claims = await getAdminSessionClaims(getCookie(event, ADMIN_SESSION_COOKIE));
    if (claims?.sessionId && dbSource !== "unconfigured") {
      const sql = await getSql();
      await sql.query(
        "update admin_sessions set revoked_at = current_timestamp where id = $1 and revoked_at is null",
        [claims.sessionId],
      ).catch(() => {});
    }
    setCookie(event, ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 0,
    });
    return { success: true };
  }

  const existing = await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE));
  if (existing) return { success: true, authenticated: true };

  // The key is shared by every operator, so guessing is the only attack. Count
  // every submitted key — valid or not — and lock the caller out once the
  // window is exhausted. A session probe (no key at all, which is what a plain
  // `/admin` page load sends) never counts, so refreshing while signed out can
  // never lock the operator out of their own panel.
  const fingerprint = clientFingerprint(event);
  const submittedKey = typeof body.adminKey === "string" ? body.adminKey : "";

  // "Not signed in" is a normal answer to a probe, not a failure. Returning 401
  // here made every signed-out page load write an error to the browser console
  // and read like a broken login. Only an actually wrong key is a 401.
  if (!submittedKey) return { success: true, authenticated: false };

  const attempt = await consumeAdminAttempt(`admin-login:${fingerprint}`);
  if (!attempt.allowed) throw tooManyAttemptsError(attempt.retryAfterSeconds);

  if (!isAdminKeyValid(submittedKey)) {
    throw createError({
      statusCode: 401,
      statusMessage: "کلید مدیریت نادرست است.",
    });
  }

  const sessionId = randomUUID();
  const token = await createAdminSessionToken(sessionId);
  if (dbSource !== "unconfigured") {
    try {
      const sql = await getSql();
      await sql.query(
        `insert into admin_sessions (id, expires_at, client_hash, user_agent)
         values ($1, current_timestamp + interval '8 hours', $2, $3)`,
        [
          sessionId,
          createHash("sha256").update(fingerprint).digest("hex"),
          String(event.req.headers.get("user-agent") ?? "").slice(0, 500),
        ],
      );
    } catch {
      throw createError({
        statusCode: 503,
        statusMessage: "ثبت نشست مدیریت در پایگاه داده انجام نشد.",
      });
    }
  }
  await clearAdminAttempts(`admin-login:${fingerprint}`);
  setCookie(event, ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return { success: true, authenticated: true };
});
