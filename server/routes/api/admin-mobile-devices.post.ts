import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminSessionClaims, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit-log.server";
import { generateMobilePairingCode, hashMobilePairingCode } from "@/lib/mobile-ingest.server";

async function requireMobileAdmin(event: H3Event) {
  const token = getCookie(event, ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید." });
  assertSameOrigin(event);
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw createError({ statusCode: 403, statusMessage: "دسترسی مدیریت دستگاه‌های موبایل برای این حساب فعال نیست." });
  }
  return claims;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const claims = await requireMobileAdmin(event);
  if (dbSource === "unconfigured") return { devices: [], generatedAt: new Date().toISOString() };

  const body = (await readBody(event).catch(() => ({}))) as {
    action?: "list" | "create_pairing" | "revoke";
    deviceId?: string;
    label?: string;
    expiresMinutes?: number;
    limit?: number;
  };
  const sql = await getSql();

  if ((body.action ?? "list") === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      `select d.id, d.platform, d.app_version, d.device_model, d.os_version, d.device_label,
              d.enabled, d.first_seen_at, d.last_seen_at,
              coalesce(e.event_count, 0)::int as event_count
         from mobile_devices d
         left join (
           select device_id, count(*)::int as event_count
             from mobile_telemetry_events group by device_id
         ) e on e.device_id = d.id
        order by d.enabled desc, d.last_seen_at desc nulls last, d.first_seen_at desc
        limit $1`,
      [Math.min(200, Math.max(1, Number(body.limit) || 100))],
    );
    return {
      devices: rows.map((row) => ({
        id: String(row.id), platform: String(row.platform), appVersion: String(row.app_version ?? ""),
        deviceModel: String(row.device_model ?? ""), osVersion: String(row.os_version ?? ""),
        label: String(row.device_label ?? ""), enabled: Boolean(row.enabled),
        firstSeenAt: String(row.first_seen_at), lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
        eventCount: Number(row.event_count) || 0,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  if (body.action === "create_pairing") {
    const code = generateMobilePairingCode();
    const expiresMinutes = Math.min(30, Math.max(3, Number(body.expiresMinutes) || 10));
    const label = String(body.label ?? "دستگاه جدید").trim().slice(0, 120) || "دستگاه جدید";
    await sql.query("update mobile_pairing_codes set used_at=current_timestamp where used_at is null and expires_at <= current_timestamp");
    const pairingId = crypto.randomUUID();
    await sql.query(
      `insert into mobile_pairing_codes (id, code_hash, created_by, expires_at)
       values ($1,$2,$3,current_timestamp + ($4::text || ' minutes')::interval)`,
      [pairingId, hashMobilePairingCode(code), String(claims?.displayName ?? "مدیر").slice(0, 120), String(expiresMinutes)],
    );
    await writeAdminAuditLog({
      action: "mobile_pairing_created",
      entityType: "mobile_pairing_code",
      entityId: pairingId,
      metadata: { label, expiresMinutes },
    });
    return {
      success: true, pairingCode: code, expiresMinutes,
      expiresAt: new Date(Date.now() + expiresMinutes * 60_000).toISOString(), label,
    };
  }

  if (body.action === "revoke") {
    const deviceId = String(body.deviceId ?? "").trim();
    if (!deviceId) throw createError({ statusCode: 400, statusMessage: "شناسه دستگاه مشخص نیست." });
    const changed = await sql.query("update mobile_devices set enabled=false where id=$1 returning id", [deviceId]);
    if (!changed.length) throw createError({ statusCode: 404, statusMessage: "دستگاه پیدا نشد." });
    await writeAdminAuditLog({
      action: "mobile_device_revoked",
      entityType: "mobile_device",
      entityId: deviceId,
    });
    return { success: true, deviceId };
  }

  throw createError({ statusCode: 400, statusMessage: "عملیات دستگاه موبایل نامعتبر است." });
});
