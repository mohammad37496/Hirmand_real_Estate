import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { authenticateSignedRequest, computeEffectiveAccess, type PhoneBridgeModule } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { MODULE_LABELS } from "@/lib/phone-bridge-policy.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

/** Maps a command action to the module that must be effective for it to run. */
const ACTION_MODULE: Record<string, PhoneBridgeModule> = {
  get_location: "location",
  take_photo: "camera",
  record_audio: "microphone",
  manage_files: "selected_files",
  list_apps: "apps",
  list_notifications: "notifications",
  restore_data: "remote_control",
};

/**
 * Command delivery (`GET /api/device-sync/v1/remote-control/command`).
 *
 * Delivering a command is a *claim*, not a read: the row is moved
 * `queued -> delivered` with a conditional UPDATE, so two pollers racing on the
 * same row cannot both win. That is what makes duplicate execution impossible
 * rather than merely unlikely.
 *
 * A command whose module is not currently effective is returned as `null` and
 * left in place — it is not silently dropped, because the admin needs to see
 * that it is blocked and why.
 *
 * Note the HMAC here is over an *empty* body, matching `RemoteControlService`
 * which signs `ByteArray(0)` on this GET.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("remote-command", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    return { ok: true, command: null };
  }

  const query = getQuery(event);
  const requestedDeviceId = String(query.deviceId ?? "").trim();
  if (requestedDeviceId && requestedDeviceId !== auth.device.id) {
    throw createError({ statusCode: 403, statusMessage: "درخواست فرمان برای دستگاه دیگری است." });
  }

  // Expire anything past its deadline first, so an abandoned command can never be
  // delivered hours later just because the device came back online.
  await auth.sql.query(
    `update phone_bridge_commands
        set status = 'expired', finished_at = current_timestamp
      where device_id = $1
        and status in ('queued','delivered','running')
        and expires_at is not null
        and expires_at <= current_timestamp`,
    [auth.device.id],
  );

  const pending = await auth.sql.query<{
    id: string;
    module: string;
    action: string;
    payload: unknown;
    expires_at: Date | null;
  }>(
    `select id, module, action, payload, expires_at
       from phone_bridge_commands
      where device_id = $1
        and status = 'queued'
        and (expires_at is null or expires_at > current_timestamp)
      order by requested_at asc
      limit 1`,
    [auth.device.id],
  );

  const candidate = pending[0];
  if (!candidate) return { ok: true, command: null };

  const access = await computeEffectiveAccess(auth.device, auth.sql);
  const requiredModule = ACTION_MODULE[candidate.action];
  if (!requiredModule || !access.effective.includes(requiredModule)) {
    await writePhoneBridgeAudit({
      deviceId: auth.device.id,
      action: "remote_command.blocked",
      module: candidate.module || requiredModule || "unknown",
      result: "denied",
      policy: access.effective.join(","),
      ip: auth.clientIp,
      userAgent: auth.userAgent,
      detail: { commandId: candidate.id, action: candidate.action },
    });
    return { ok: true, command: null, blockedReason: "module_not_effective" };
  }

  // Conditional claim: only the request whose UPDATE actually changed a row owns
  // the command. A concurrent poller sees status = 'delivered' and moves on.
  const claimed = await auth.sql.query<{ id: string }>(
    `update phone_bridge_commands
        set status = 'delivered', delivered_at = current_timestamp
      where id = $1
        and status = 'queued'
      returning id`,
    [candidate.id],
  );

  if (!claimed[0]) return { ok: true, command: null };

  await auth.sql.query(
    `update phone_bridge_commands set status = 'running' where id = $1 and status = 'delivered'`,
    [candidate.id],
  );

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "remote_command.deliver",
    module: candidate.module || requiredModule,
    policy: access.effective.join(","),
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: { commandId: candidate.id, action: candidate.action },
  });

  return {
    ok: true,
    command: {
      id: candidate.id,
      action: candidate.action,
      module: candidate.module || requiredModule,
      moduleLabel: MODULE_LABELS[requiredModule] ?? candidate.module,
      payload: (candidate.payload ?? {}) as Record<string, unknown>,
      expiresAt: candidate.expires_at ? new Date(candidate.expires_at).toISOString() : null,
    },
  };
});