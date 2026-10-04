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
import { recordPhoneBridgeEvent } from "@/lib/phone-bridge-events.server";
import { randomUUID } from "node:crypto";

async function requireRemoteControlAdmin() {
  const token = getCookie(ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) throw new Error("نشست مدیریت معتبر نیست.");
  assertAdminServerFnOrigin();
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw new Error("برای استفاده از کنترل ریموت Phone Bridge مجوز امنیت مدیران لازم است.");
  }
  return claims;
}

export type RemoteCommandAction = "get_location";
export type PhoneBridgeRemoteCommand = {
  id: string;
  deviceId: string;
  deviceName: string;
  action: RemoteCommandAction;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  result: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number | null;
    altitudeMeters?: number | null;
    speedMps?: number | null;
    bearingDegrees?: number | null;
    provider?: string;
    recordedAt?: string;
  } | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
};

function mapRow(row: Record<string, unknown>): PhoneBridgeRemoteCommand {
  const raw = row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : null;
  return {
    id: String(row.id),
    deviceId: String(row.device_id),
    deviceName: String(row.device_name ?? "گوشی ناشناس"),
    action: String(row.action) as RemoteCommandAction,
    status: String(row.status) as PhoneBridgeRemoteCommand["status"],
    result: raw ? {
      latitude: typeof raw.latitude === "number" ? raw.latitude : undefined,
      longitude: typeof raw.longitude === "number" ? raw.longitude : undefined,
      accuracyMeters: typeof raw.accuracyMeters === "number" ? raw.accuracyMeters : null,
      altitudeMeters: typeof raw.altitudeMeters === "number" ? raw.altitudeMeters : null,
      speedMps: typeof raw.speedMps === "number" ? raw.speedMps : null,
      bearingDegrees: typeof raw.bearingDegrees === "number" ? raw.bearingDegrees : null,
      provider: typeof raw.provider === "string" ? raw.provider : undefined,
      recordedAt: typeof raw.recordedAt === "string" ? raw.recordedAt : (typeof raw.recordedAt === "number" ? new Date(raw.recordedAt).toISOString() : undefined),
    } : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    startedAt: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  };
}

export const createPhoneBridgeRemoteCommand = createServerFn({ method: "POST" })
  .validator(z.object({
    deviceId: z.string().trim().min(1).max(120),
    action: z.literal("get_location"),
  }))
  .handler(async ({ data }) => {
    const claims = await requireRemoteControlAdmin();
    if (dbSource === "unconfigured") return { success: false, commandId: null };

    const sql = await getSql();
    const deviceRows = await sql.query<{ enabled: boolean; allowed_modules: unknown; name: string }>(
      "select enabled,allowed_modules,name from phone_bridge_devices where id=$1 limit 1",
      [data.deviceId],
    );
    const device = deviceRows[0];
    if (!device) throw new Error("دستگاه پیدا نشد.");
    if (!device.enabled) throw new Error("این دستگاه غیرفعال است.");
    const modules = device.allowed_modules && typeof device.allowed_modules === "object"
      ? device.allowed_modules as Record<string, unknown>
      : {};
    if (modules.location === false) throw new Error("ماژول موقعیت برای این دستگاه غیرفعال است.");

    const active = await sql.query<{ id: string }>(
      "select id from phone_bridge_remote_commands where device_id=$1 and status in ('queued','running') and expires_at >= current_timestamp limit 1",
      [data.deviceId],
    );
    if (active.length) throw new Error("یک فرمان ریموت هنوز در حال اجراست؛ ابتدا نتیجهٔ آن را دریافت کن.");

    const id = randomUUID();
    await sql.query(
      "insert into phone_bridge_remote_commands (id,device_id,action,status,payload,requested_by,expires_at) values ($1,$2,$3,'queued','{}'::jsonb,$4,current_timestamp + interval '60 seconds')",
      [id, data.deviceId, data.action, claims?.options?.accountId ?? null],
    );
    await recordPhoneBridgeEvent({
      deviceId: data.deviceId,
      actorAccountId: claims?.options?.accountId ?? null,
      eventType: "remote.command_requested",
      severity: "warning",
      message: "فرمان ریموت دریافت لوکیشن ثبت شد.",
      metadata: { commandId: id, action: data.action },
    });
    return { success: true, commandId: id };
  });

export const getPhoneBridgeRemoteCommand = createServerFn({ method: "POST" })
  .validator(z.object({ commandId: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    await requireRemoteControlAdmin();
    if (dbSource === "unconfigured") return null;

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      "select c.*,coalesce(d.name,'گوشی ناشناس') as device_name from phone_bridge_remote_commands c left join phone_bridge_devices d on d.id=c.device_id where c.id=$1 limit 1",
      [data.commandId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  });

export const listPhoneBridgeRemoteCommands = createServerFn({ method: "POST" })
  .validator(z.object({
    deviceId: z.string().trim().min(1).max(120),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }))
  .handler(async ({ data }) => {
    await requireRemoteControlAdmin();
    if (dbSource === "unconfigured") return [];

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      "select c.*,coalesce(d.name,'گوشی ناشناس') as device_name from phone_bridge_remote_commands c left join phone_bridge_devices d on d.id=c.device_id where c.device_id=$1 order by c.created_at desc limit $2",
      [data.deviceId, data.limit],
    );
    return rows.map(mapRow);
  });
