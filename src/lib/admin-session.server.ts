import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { dbSource, getSql } from "@/lib/db";

export const ADMIN_SESSION_COOKIE =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
    ? "__Host-hirmand-admin"
    : "hirmand-admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminSessionClaims = {
  sessionId: string | null;
  issuedAt: number | null;
  expiresAt: number | null;
};

function sessionSecret() {
  const adminKey = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!adminKey) throw new Error("HIRMAND_ADMIN_KEY تنظیم نشده است.");
  return createHash("sha256").update(adminKey).digest();
}

export async function createAdminSessionToken(sessionId = randomUUID()) {
  const secret = sessionSecret();
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("hirmand-admin")
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

async function verifyPayload(token: string | undefined): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      subject: "hirmand-admin",
    });
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSessionClaims(token: string | undefined): Promise<AdminSessionClaims | null> {
  const payload = await verifyPayload(token);
  if (!payload) return null;

  const sessionId = typeof payload.jti === "string" && payload.jti.trim() ? payload.jti : null;
  if (sessionId && dbSource !== "unconfigured") {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ id: string }>(
        `select id
         from admin_sessions
         where id = $1
           and revoked_at is null
           and expires_at > current_timestamp
         limit 1`,
        [sessionId],
      );
      if (!rows.length) return null;
      await sql.query(
        `update admin_sessions
         set last_seen_at = current_timestamp
         where id = $1
           and revoked_at is null`,
        [sessionId],
      ).catch(() => {});
    } catch {
      return null;
    }
  }

  return {
    sessionId,
    issuedAt: typeof payload.iat === "number" ? payload.iat : null,
    expiresAt: typeof payload.exp === "number" ? payload.exp : null,
  };
}

export async function verifyAdminSessionToken(token: string | undefined) {
  return Boolean(await getAdminSessionClaims(token));
}

export async function revokeAdminSession(sessionId: string) {
  if (dbSource === "unconfigured") return false;
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update admin_sessions
     set revoked_at = current_timestamp
     where id = $1
       and revoked_at is null
     returning id`,
    [sessionId],
  );
  return rows.length > 0;
}

export function isAdminKeyValid(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey) return false;
  const actual = Buffer.from(adminKey.trim());
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
