import { createError, defineEventHandler, setResponseHeader } from "h3";
import { authenticateSignedRequest, readSignedBody, type PhoneBridgeModule } from "@/lib/phone-bridge-auth.server";
import { writePhoneBridgeAudit } from "@/lib/phone-bridge-events.server";
import { remoteResultSchema } from "@/lib/phone-bridge-payload.server";
import { consumePhoneBridgeAttempt } from "@/lib/phone-bridge-rate-limit.server";

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
 * Command result (`POST /api/device-sync/v1/remote-control/result`).
 *
 * A result only counts if the command belongs to *this* device — the row is
 * matched on `id = $1 and device_id = $2`, so a device cannot complete another
 * device's command even if it guessed the id.
 *
 * A late result for an expired command is accepted and recorded, but the row
 * stays `expired`: the command genuinely did not complete inside its window, and
 * rewriting that to `succeeded` would hide a real delivery failure from the
 * admin's audit view.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const auth = await authenticateSignedRequest(event);

  const limit = await consumePhoneBridgeAttempt("result", auth.device.id);
  if (!limit.allowed) {
    setResponseHeader(event, "retry-after", String(limit.retryAfterSeconds));
    throw createError({ statusCode: 429, statusMessage: "تعداد گزارش نتیجه بیش از حد مجاز است." });
  }

  const raw = await readSignedBody(event);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "محتوای درخواست JSON معتبر نیست." });
  }

  const parsed = remoteResultSchema.safeParse(json);
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: "ساختار نتیجهٔ فرمان معتبر نیست." });
  }

  const { commandId, action, success, error, result } = parsed.data;
  if (parsed.data.deviceId && parsed.data.deviceId !== auth.device.id) {
    throw createError({ statusCode: 403, statusMessage: "شناسهٔ دستگاه در نتیجه با توکن هم‌خوانی ندارد." });
  }

  const claimed = await auth.sql.query<{ status: string; expires_at: Date | null }>(
    `update phone_bridge_commands
        set status = $3,
            result = $4::jsonb,
            error = $5,
            finished_at = current_timestamp
      where id = $1
        and device_id = $2
        and status in ('delivered','running','expired')
      returning status, expires_at`,
    [commandId, auth.device.id, success ? "succeeded" : "failed", JSON.stringify(result), error ?? null],
  );

  const finalStatus = claimed[0]?.status;
  if (!finalStatus) {
    // Either the command does not exist for this device, or it already finished.
    // A duplicate result is not an error for the device — it just stops retrying.
    return { ok: true, accepted: false, reason: "unknown_or_already_finished_command" };
  }

  await writePhoneBridgeAudit({
    deviceId: auth.device.id,
    action: "remote_command.result",
    module: ACTION_MODULE[action] ?? "",
    result: success ? "ok" : "error",
    ip: auth.clientIp,
    userAgent: auth.userAgent,
    detail: { commandId, action, success, previousStatus: finalStatus, error: error ?? undefined },
  });

  return { ok: true, accepted: true, status: finalStatus };
});