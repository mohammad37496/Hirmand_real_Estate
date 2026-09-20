import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "__Host-hirmand-admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

function sessionSecret() {
  const adminKey = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!adminKey) throw new Error("HIRMAND_ADMIN_KEY تنظیم نشده است.");
  return createHash("sha256").update(adminKey).digest();
}

export async function createAdminSessionToken() {
  const secret = sessionSecret();
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("hirmand-admin")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      subject: "hirmand-admin",
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export function isAdminKeyValid(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  return Boolean(expected && adminKey && adminKey.trim() === expected);
}
