import { createError, defineEventHandler, setResponseHeader } from "h3";
import { authenticateSignedRequest, readSignedBody, computeEffectiveAccess } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { heartbeatSchema } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

/**
 * Heartbeat (`POST /api/device-sync/v1/heartbeat`).
 *
 * This is the delta-mode optimization the app implements: when nothing the
 * device reports has changed, it sends only this small packet instead of a full
 * snapshot. The server answers `snapshotRequired` when it wants the full packet —
 * which is true whenever the client has no `last_sync_hash`, or the hash it
 * reports does not match what we last stored.
 *
 * Storing the health columns here is what makes the admin devices table show a
 * live battery / storage / RAM figure without waiting for a full sync.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("heartbeat", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد heartbeat بیش از حد مجاز است." });
  }

  const raw = await readSignedBody(event);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "محتوای heartbeat معتبر نیست." });
  }

  const parsed = heartbeatSchema.safeParse(json);
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: "ساختار heartbeat معتبر نیست." });
  }

  const stats = parsed.data.deviceStats;
  const queue = parsed.data.queue;

  await auth.sql.query(
    `insert into phone_bridge_heartbeats
       (device_id, snapshot_hash, battery_percent, battery_charging,
        storage_available_bytes, storage_total_bytes,
        ram_available_bytes, ram_total_bytes, queue_queued, queue_dead_letters)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      auth.device.id,
      parsed.data.snapshotHash,
      stats.batteryPercent,
      stats.batteryCharging,
      stats.storageAvailableBytes,
      stats.storageTotalBytes,
      stats.ramAvailableBytes,
      stats.ramTotalBytes,
      queue.queued,
      queue.deadLetters,
    ],
  );

  await auth.sql.query(
    `update phone_bridge_devices
        set battery_percent = $2,
            battery_charging = $3,
            storage_available_bytes = $4,
            storage_total_bytes = $5,
            ram_available_bytes = $6,
            ram_total_bytes = $7,
            updated_at = current_timestamp
      where id = $1`,
    [
      auth.device.id,
      stats.batteryPercent,
      stats.batteryCharging,
      stats.storageAvailableBytes,
      stats.storageTotalBytes,
      stats.ramAvailableBytes,
      stats.ramTotalBytes,
    ],
  );

  // A device whose policy was tightened while it was offline needs the policy
  // back, and the app shows it immediately — which is what makes "admin disables
  // a module" visibly take effect on the handset.
  const access = await computeEffectiveAccess(auth.device, auth.sql);

  const snapshotRequired =
    !auth.device.lastSnapshotHash || parsed.data.snapshotHash !== auth.device.lastSnapshotHash;

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "device.heartbeat",
    policy: access.effective.join(","),
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: {
      snapshotRequired,
      queueQueued: queue.queued,
      deadLetters: queue.deadLetters,
    },
  });

  return {
    ok: true,
    snapshotRequired,
    effectiveModules: access.effective,
    // The app compares this against its own BuildConfig.VERSION_CODE and forces
    // an upgrade when the operator has raised the floor.
    minAppVersionCode: access.minAppVersionCode,
  };
});