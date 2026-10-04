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
import { recordPhoneBridgeEvent, type PhoneBridgeEventSeverity } from "@/lib/phone-bridge-events.server";

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

type PhoneBridgeJson =
  | string
  | number
  | boolean
  | null
  | PhoneBridgeJson[]
  | { [key: string]: PhoneBridgeJson };

function toPhoneBridgeJson(value: unknown): PhoneBridgeJson {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toPhoneBridgeJson);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPhoneBridgeJson(item)]),
    );
  }
  return String(value);
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
  health: {
    status: "online" | "stale" | "offline";
    lastHeartbeatAt: string;
    batteryPercent: number | null;
    batteryCharging: boolean | null;
    storageAvailableBytes: number | null;
    storageTotalBytes: number | null;
    ramAvailableBytes: number | null;
    ramTotalBytes: number | null;
  };
};

export type PhoneBridgeEvent = {
  id: string;
  deviceId: string | null;
  deviceName: string;
  eventType: string;
  severity: PhoneBridgeEventSeverity;
  message: string;
  metadata: PhoneBridgeJson;
  createdAt: string;
};

export const getPhoneBridgeEventOverview = createServerFn({ method: "POST" })
  .validator(z.object({}).optional())
  .handler(async () => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return { total: 0, last24h: 0, errors24h: 0, critical24h: 0 };

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        count(*) as total,
        count(*) filter (where created_at >= current_timestamp - interval '24 hours') as last_24h,
        count(*) filter (where created_at >= current_timestamp - interval '24 hours' and severity in ('error','critical')) as errors_24h,
        count(*) filter (where created_at >= current_timestamp - interval '24 hours' and severity='critical') as critical_24h
       from phone_bridge_events`,
    );
    const row = rows[0] ?? {};
    return {
      total: Number(row.total ?? 0),
      last24h: Number(row.last_24h ?? 0),
      errors24h: Number(row.errors_24h ?? 0),
      critical24h: Number(row.critical_24h ?? 0),
    };
  });

const eventListInput = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  deviceId: z.string().trim().min(1).max(120).optional(),
  severity: z.enum(["info","warning","error","critical"]).optional(),
});

export const listPhoneBridgeEvents = createServerFn({ method: "POST" })
  .validator(eventListInput)
  .handler(async ({ data }) => {
    await requirePhoneBridgeAdmin();
    if (dbSource === "unconfigured") return [];

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select
        e.id,e.device_id,e.event_type,e.severity,e.message,e.metadata,e.created_at,
        coalesce(d.name,'گوشی ناشناس') as device_name
       from phone_bridge_events e
       left join phone_bridge_devices d on d.id=e.device_id
       where ($1::text is null or e.device_id=$1)
         and ($2::text is null or e.severity=$2)
       order by e.created_at desc
       limit $3`,
      [data.deviceId ?? null, data.severity ?? null, data.limit],
    );

    return rows.map((row) => ({
      id: String(row.id),
      deviceId: row.device_id ? String(row.device_id) : null,
      deviceName: String(row.device_name ?? "گوشی ناشناس"),
      eventType: String(row.event_type ?? ""),
      severity: (["info","warning","error","critical"].includes(String(row.severity))
        ? String(row.severity)
        : "info") as PhoneBridgeEventSeverity,
      message: String(row.message ?? ""),
      metadata: toPhoneBridgeJson(row.metadata),
      createdAt: new Date(String(row.created_at)).toISOString(),
    }));
  });

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
      `select
        d.id,d.name,d.manufacturer,d.model,d.android_version,d.sdk_int,d.first_seen_at,d.last_seen_at,
        d.last_sync_id,d.last_summary,d.enabled,d.token_created_at,d.last_authenticated_at,
        latest.received_at as latest_sync_received_at,
        latest.device_stats as latest_device_stats
       from phone_bridge_devices d
       left join lateral (
         select s.received_at, s.payload->'deviceStats' as device_stats
         from phone_bridge_syncs s
         where s.device_id=d.id
         order by s.received_at desc
         limit 1
       ) latest on true
       order by d.last_seen_at desc
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
        health: (() => {
          const heartbeatAt = new Date(String(row.last_seen_at));
          const ageMs = Math.max(0, Date.now() - heartbeatAt.getTime());
          const status: PhoneBridgeDevice["health"]["status"] =
            ageMs <= 30 * 60 * 1000 ? "online" :
            ageMs <= 24 * 60 * 60 * 1000 ? "stale" :
            "offline";
          const rawStats = row.latest_device_stats && typeof row.latest_device_stats === "string"
            ? JSON.parse(row.latest_device_stats)
            : row.latest_device_stats;
          const stats = rawStats && typeof rawStats === "object"
            ? rawStats as Record<string, unknown>
            : {};
          const numberOrNull = (value: unknown) =>
            typeof value === "number" && Number.isFinite(value) ? value : null;
          return {
            status,
            lastHeartbeatAt: heartbeatAt.toISOString(),
            batteryPercent: numberOrNull(stats.batteryPercent),
            batteryCharging: typeof stats.batteryCharging === "boolean" ? stats.batteryCharging : null,
            storageAvailableBytes: numberOrNull(stats.storageAvailableBytes),
            storageTotalBytes: numberOrNull(stats.storageTotalBytes),
            ramAvailableBytes: numberOrNull(stats.ramAvailableBytes),
            ramTotalBytes: numberOrNull(stats.ramTotalBytes),
          };
        })(),
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
      payload: toPhoneBridgeJson(row.payload),
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
    await sql.query(
      `delete from phone_bridge_events
       where created_at < current_timestamp - make_interval(days => $1::int)`,
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
    if (rows.length > 0) {
      await recordPhoneBridgeEvent({
        deviceId: data.deviceId,
        eventType: "device.enabled_changed",
        severity: data.enabled ? "info" : "warning",
        message: data.enabled ? "دستگاه توسط مدیر فعال شد." : "دستگاه توسط مدیر غیرفعال شد.",
        metadata: { enabled: data.enabled },
      });
    }
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
    if (rows.length > 0) {
      await recordPhoneBridgeEvent({
        deviceId: data.deviceId,
        eventType: "security.token_rotated",
        severity: "warning",
        message: "توکن اختصاصی دستگاه توسط مدیر تعویض شد.",
      });
    }
    return { success: rows.length > 0, token: rows.length > 0 ? token : null };
  });
