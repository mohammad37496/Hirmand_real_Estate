import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionClaims,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";
import { assertAdminServerFnOrigin } from "@/lib/admin-server-fn-guard.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { generateDeviceToken, hashToken } from "@/lib/phone-bridge-auth";

async function requirePhoneBridgeAdmin() {
  const token = getCookie(ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) throw new Error("نشست مدیریت معتبر نیست.");
  assertAdminServerFnOrigin();
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw new Error("برای مشاهدهٔ داده‌های گوشی مجوز امنیت مدیران لازم است.");
  }
  return claims;
}

const listInput = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  deviceId: z.string().trim().min(1).max(120).optional(),
});

export type PhoneBridgeDevice = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkInt: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncId: string | null;
  summary: {
    contacts: number;
    calls: number;
    sms: number;
    calendar: number;
    apps: number;
    selectedFiles: number;
    hasLocation: boolean;
    hasWifi: boolean;
    hasDeviceStats: boolean;
  };
  enabled: boolean;
  tokenCreatedAt: string | null;
  lastAuthenticatedAt: string | null;
};

export const getPhoneBridgeOverview = createServerFn({ method: "POST" })
  .validator(z.object({}).optional())
  .handler(async () => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return { devices: 0, syncs: 0, lastReceivedAt: null };

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        (select count(*) from phone_bridge_devices) as devices,
        (select count(*) from phone_bridge_syncs) as syncs,
        (select max(received_at) from phone_bridge_syncs) as last_received_at`,
    );
    const row = rows[0] ?? {};
    return {
      devices: Number(row.devices ?? 0),
      syncs: Number(row.syncs ?? 0),
      lastReceivedAt: row.last_received_at ? new Date(String(row.last_received_at)).toISOString() : null,
    };
  });

export const listPhoneBridgeDevices = createServerFn({ method: "POST" })
  .validator(z.object({ limit: z.number().int().min(1).max(100).optional().default(50) }).optional())
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return [];

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select id,name,manufacturer,model,android_version,sdk_int,first_seen_at,last_seen_at,last_sync_id,last_summary,enabled,token_created_at,last_authenticated_at
       from phone_bridge_devices
       order by last_seen_at desc
       limit $1`,
      [data?.limit ?? 50],
    );

    return rows.map((row) => {
      const raw = row.last_summary && typeof row.last_summary === "string"
        ? JSON.parse(row.last_summary)
        : row.last_summary;
      const summary = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? "گوشی"),
        manufacturer: String(row.manufacturer ?? ""),
        model: String(row.model ?? ""),
        androidVersion: String(row.android_version ?? ""),
        sdkInt: row.sdk_int == null ? null : Number(row.sdk_int),
        firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
        lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
        lastSyncId: row.last_sync_id ? String(row.last_sync_id) : null,
        summary: {
          contacts: Number(summary.contacts ?? 0),
          calls: Number(summary.calls ?? 0),
          sms: Number(summary.sms ?? 0),
          calendar: Number(summary.calendar ?? 0),
          apps: Number(summary.apps ?? 0),
          selectedFiles: Number(summary.selectedFiles ?? 0),
          hasLocation: Boolean(summary.hasLocation),
          hasWifi: Boolean(summary.hasWifi),
          hasDeviceStats: Boolean(summary.hasDeviceStats),
        },
        enabled: Boolean(row.enabled),
        tokenCreatedAt: row.token_created_at ? new Date(String(row.token_created_at)).toISOString() : null,
        lastAuthenticatedAt: row.last_authenticated_at ? new Date(String(row.last_authenticated_at)).toISOString() : null,
      };
    });
  });

export const listPhoneBridgeSyncs = createServerFn({ method: "POST" })
  .validator(listInput)
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return [];

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select s.id,s.device_id,s.schema_name,s.sent_at,s.received_at,s.payload_bytes,s.summary,d.name
       from phone_bridge_syncs s
       join phone_bridge_devices d on d.id=s.device_id
       where ($1::text is null or s.device_id=$1)
       order by s.received_at desc
       limit $2`,
      [data.deviceId ?? null, data.limit],
    );

    return rows.map((row) => {
      const raw = row.summary && typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
      const summary = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return {
        id: String(row.id),
        deviceId: String(row.device_id),
        deviceName: String(row.name ?? "گوشی"),
        receivedAt: new Date(String(row.received_at)).toISOString(),
        sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : null,
        payloadBytes: Number(row.payload_bytes ?? 0),
        summary: {
          contacts: Number(summary.contacts ?? 0),
          calls: Number(summary.calls ?? 0),
          sms: Number(summary.sms ?? 0),
          calendar: Number(summary.calendar ?? 0),
          apps: Number(summary.apps ?? 0),
          selectedFiles: Number(summary.selectedFiles ?? 0),
          hasLocation: Boolean(summary.hasLocation),
          hasWifi: Boolean(summary.hasWifi),
          hasDeviceStats: Boolean(summary.hasDeviceStats),
        },
      };
    });
  });

export const getPhoneBridgeSync = createServerFn({ method: "POST" })
  .validator(z.object({ syncId: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return null;

    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown; received_at: string; device_id: string }>(
      `select payload,received_at,device_id from phone_bridge_syncs where id=$1 limit 1`,
      [data.syncId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      syncId: data.syncId,
      deviceId: String(row.device_id),
      receivedAt: new Date(String(row.received_at)).toISOString(),
      payload: row.payload,
    };
  });

export const purgePhoneBridgeData = createServerFn({ method: "POST" })
  .validator(z.object({ olderThanDays: z.number().int().min(1).max(3650).default(30) }))
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return { deleted: 0 };

    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `delete from phone_bridge_syncs
       where received_at < current_timestamp - make_interval(days => $1::int)
       returning id`,
      [data.olderThanDays],
    );
    const files = await sql.query<{ id: string }>(
      `delete from phone_bridge_files
       where uploaded_at < current_timestamp - make_interval(days => $1::int)
       returning id`,
      [data.olderThanDays],
    );
    return { deleted: rows.length, filesDeleted: files.length };
  });


export const setPhoneBridgeDeviceEnabled = createServerFn({ method: "POST" })
  .validator(z.object({ deviceId: z.string().trim().min(1).max(120), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return { success: false, enabled: data.enabled };
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update phone_bridge_devices set enabled=$2 where id=$1 returning id`,
      [data.deviceId, data.enabled],
    );
    return { success: rows.length > 0, enabled: data.enabled };
  });

export const rotatePhoneBridgeDeviceToken = createServerFn({ method: "POST" })
  .validator(z.object({ deviceId: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return { success: false, token: null };
    const token = generateDeviceToken();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update phone_bridge_devices
       set token_hash=$2,token_created_at=current_timestamp,enabled=true
       where id=$1
       returning id`,
      [data.deviceId, hashToken(token)],
    );
    return { success: rows.length > 0, token: rows.length > 0 ? token : null };
  });
