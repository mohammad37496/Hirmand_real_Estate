/**
 * Audit trail and retention for Phone Bridge.
 *
 * Every sensitive action — enrollment, a refused sync, a remote command, a
 * policy change — writes one row here with who / device / action / result / ip /
 * user agent / policy.
 *
 * Two rules the writer enforces so it cannot become a leak:
 *   1. It never accepts a caller-supplied `detail` object containing keys that
 *      look like credentials; those are dropped rather than stored.
 *   2. Auditing never breaks the request. A failed audit insert is swallowed and
 *      logged to stderr, because losing the sync packet is far worse than losing
 *      its audit line.
 */

import { dbSource, getSql, type Sql } from "@/lib/db";

const SENSITIVE_KEY = /(token|secret|password|passphrase|credential|authorization|signature|key)/i;

/** Strips credential-shaped keys from an audit detail object. */
export function scrubAuditDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string") {
      out[key] = value.length > 400 ? `${value.slice(0, 400)}…` : value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 20);
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = scrubAuditDetail(value as Record<string, unknown>);
    }
  }
  return out;
}

export type AuditInput = {
  deviceId?: string | null;
  actor?: string;
  action: string;
  module?: string;
  result?: "ok" | "denied" | "error";
  policy?: string;
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
};

export async function writePhoneBridgeAudit(input: AuditInput, sql?: Sql): Promise<void> {
  // No database configured means there is nothing to audit into; failing loudly
  // here would turn a successful request into an error.
  if (dbSource === "unconfigured") return;
  try {
    const db = sql ?? (await getSql());
    await db.query(
      `insert into phone_bridge_audit_log
         (device_id, actor, action, module, result, policy, ip, user_agent, detail)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.deviceId ?? null,
        (input.actor ?? "device").slice(0, 120),
        input.action.slice(0, 80),
        (input.module ?? "").slice(0, 60),
        input.result ?? "ok",
        (input.policy ?? "").slice(0, 120),
        (input.ip ?? "").slice(0, 64),
        (input.userAgent ?? "").slice(0, 200),
        JSON.stringify(scrubAuditDetail(input.detail ?? {})),
      ],
    );
  } catch (error) {
    console.error(
      "[phone-bridge-audit] could not record audit row:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Stores a sync snapshot, or reports that this exact one is already stored.
 *
 * Idempotency is enforced by the `(device_id, snapshot_hash)` unique index rather
 * than a read-then-write, because two retries racing would both pass a read. The
 * catch therefore only has to distinguish "duplicate" from a real failure.
 */
export async function storeSnapshot(
  sql: Sql,
  input: {
    deviceId: string;
    syncId: string;
    snapshotHash: string;
    schema: string;
    appVersionName: string;
    appVersionCode: number | null;
    payload: Record<string, unknown>;
  },
): Promise<{ stored: boolean }> {
  try {
    await sql.query(
      `insert into phone_bridge_snapshots
         (id, device_id, sync_id, snapshot_hash, schema, app_version_name, app_version_code, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict (device_id, snapshot_hash) where snapshot_hash <> '' do nothing`,
      [
        crypto.randomUUID(),
        input.deviceId,
        input.syncId,
        input.snapshotHash,
        input.schema,
        input.appVersionName,
        input.appVersionCode,
        JSON.stringify(input.payload),
      ],
    );
    return { stored: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { stored: false };
    throw error;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Records a location fix, deduplicated by `clientPointId`.
 *
 * The device re-sends the same fix whenever the network comes back, so the
 * unique index is what stops a flaky connection from filling the table with
 * copies of the same point.
 */
export async function storeLocation(
  sql: Sql,
  input: {
    deviceId: string;
    clientPointId: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    altitudeMeters: number | null;
    speedMps: number | null;
    bearingDegrees: number | null;
    provider: string;
    recordedAtMs: number;
    recordedAtIso: string;
  },
): Promise<{ stored: boolean }> {
  try {
    await sql.query(
      `insert into phone_bridge_locations
         (id, device_id, client_point_id, latitude, longitude, accuracy_meters,
          altitude_meters, speed_mps, bearing_degrees, provider, recorded_at_ms, recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz)
       on conflict (device_id, client_point_id) do nothing`,
      [
        crypto.randomUUID(),
        input.deviceId,
        input.clientPointId,
        input.latitude,
        input.longitude,
        input.accuracyMeters,
        input.altitudeMeters,
        input.speedMps,
        input.bearingDegrees,
        input.provider,
        input.recordedAtMs,
        input.recordedAtIso,
      ],
    );
    return { stored: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { stored: false };
    throw error;
  }
}

/**
 * Retention purge for raw operational data.
 *
 * Defaults to 30 days and is overridable with PHONE_BRIDGE_RETENTION_DAYS. The
 * audit log is deliberately *not* purged here: it is the record of who did what,
 * and losing it would defeat the point of having it.
 */
export function retentionDays(): number {
  const raw = Number(process.env.PHONE_BRIDGE_RETENTION_DAYS ?? 30);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 3650) : 30;
}

export async function purgeExpiredOperationalData(sql?: Sql): Promise<{ snapshots: number }> {
  if (dbSource === "unconfigured") return { snapshots: 0 };
  const db = sql ?? (await getSql());
  const days = retentionDays();
  const rows = await db.query<{ count: number }>(
    `with deleted as (
       delete from phone_bridge_snapshots
        where received_at < current_timestamp - make_interval(days => $1)
        returning 1
     )
     select count(*)::int as count from deleted`,
    [days],
  );
  return { snapshots: rows[0]?.count ?? 0 };
}