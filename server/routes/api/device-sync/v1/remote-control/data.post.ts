import { createError, defineEventHandler, readRawBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { authenticateDevice } from "@/lib/phone-bridge-auth";
import { requirePhoneBridgeSignedRequest } from "@/lib/phone-bridge-signature.server";
import { enforcePhoneBridgeRateLimit } from "@/lib/phone-bridge-rate-limit.server";

const ACTION = "restore_data";
const DATA_TYPES = new Set(["sms", "incoming_calls"]);
const MAX_BODY_BYTES = 512 * 1024;
const MAX_ROWS_PER_CHUNK = 1000;
const MAX_TOTAL_COUNT = 10000;

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function int(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });

  const raw = await readRawBody(event);
  const rawBody = raw ? Buffer.from(raw) : Buffer.alloc(0);
  if (!rawBody.length || rawBody.length > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "بستهٔ دیتای ریموت بیش از حد مجاز است." });
  }

  let body: Record<string, unknown>;
  try {
    body = obj(JSON.parse(rawBody.toString("utf8")));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "بستهٔ دیتای ریموت معتبر نیست." });
  }

  const deviceId = text(body.deviceId, 120);
  const commandId = text(body.commandId, 120);
  const action = text(body.action, 60);
  const dataType = text(body.dataType, 30);
  if (!deviceId || !commandId || action !== ACTION || !DATA_TYPES.has(dataType)) {
    throw createError({ statusCode: 400, statusMessage: "مشخصات فرمان بازگردانی دیتا معتبر نیست." });
  }

  await enforcePhoneBridgeRateLimit(event, "remote-data-result", deviceId, {
    windowMs: 10 * 60 * 1000,
    maxHits: 600,
    blockMs: 5 * 60 * 1000,
  });

  const auth = await authenticateDevice(event, deviceId);
  if (!auth.ok) throw createError({ statusCode: auth.status, statusMessage: auth.message });
  if (auth.mode === "device") await requirePhoneBridgeSignedRequest(event, deviceId, rawBody);

  const sql = await getSql();
  const commandRows = await sql.query<Record<string, unknown>>(
    "select id,action,status,payload,expires_at from phone_bridge_remote_commands where id=$1 and device_id=$2 limit 1",
    [commandId, deviceId],
  );
  const command = commandRows[0];
  if (!command) throw createError({ statusCode: 404, statusMessage: "فرمان بازگردانی دیتا پیدا نشد." });

  if (String(command.action) !== ACTION) {
    throw createError({ statusCode: 409, statusMessage: "نوع فرمان با endpoint بازگردانی دیتا سازگار نیست." });
  }
  if (!["running", "queued"].includes(String(command.status))) {
    throw createError({ statusCode: 409, statusMessage: "این فرمان قبلاً تکمیل شده یا منقضی شده است." });
  }
  if (new Date(String(command.expires_at)).getTime() < Date.now()) {
    await sql.query(
      "update phone_bridge_remote_commands set status='expired',completed_at=current_timestamp where id=$1 and status in ('queued','running')",
      [commandId],
    );
    throw createError({ statusCode: 410, statusMessage: "مهلت فرمان بازگردانی دیتا تمام شده است." });
  }

  const payload = obj(command.payload);
  if (text(payload.dataType, 30) !== dataType) {
    throw createError({ statusCode: 409, statusMessage: "نوع دیتای فرمان با نتیجهٔ گوشی یکسان نیست." });
  }

  const success = body.success !== false;
  if (!success) {
    const errorMessage = text(body.error, 500) || "بازگردانی دیتا روی گوشی ناموفق بود.";
    await sql.query(
      "update phone_bridge_remote_commands set status='failed',error_message=$2,completed_at=current_timestamp where id=$1 and status='running'",
      [commandId, errorMessage],
    );
    return { ok: true, accepted: true, commandId, completed: true };
  }

  const chunkIndex = int(body.chunkIndex);
  const chunkCount = int(body.chunkCount);
  const totalCount = int(body.totalCount);
  const rows = Array.isArray(body.rows) ? body.rows : null;
  const isFinal = body.final === true;

  if (
    chunkIndex === null || chunkCount === null || totalCount === null || !rows ||
    chunkIndex < 0 || chunkCount < 1 || chunkCount > 1000 ||
    chunkIndex >= chunkCount || totalCount < 0 || totalCount > MAX_TOTAL_COUNT ||
    rows.length > MAX_ROWS_PER_CHUNK
  ) {
    throw createError({ statusCode: 422, statusMessage: "ساختار بستهٔ دیتای ریموت معتبر نیست." });
  }
  if (isFinal && chunkIndex !== chunkCount - 1) {
    throw createError({ statusCode: 422, statusMessage: "بستهٔ نهایی ریموت جایگاه معتبری ندارد." });
  }

  const existing = await sql.query<{ id: string }>(
    "select id from phone_bridge_remote_data_chunks where command_id=$1 and chunk_index=$2 limit 1",
    [commandId, chunkIndex],
  );
  if (!existing.length) {
    await sql.query(
      "insert into phone_bridge_remote_data_chunks (id,command_id,device_id,data_type,chunk_index,chunk_count,total_count,rows) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
      [randomUUID(), commandId, deviceId, dataType, chunkIndex, chunkCount, totalCount, JSON.stringify(rows)],
    );
  }

  let completed = false;
  if (isFinal) {
    const counts = await sql.query<{ chunks: number; rows: number }>(
      "select count(*)::int as chunks,coalesce(sum(jsonb_array_length(rows)),0)::int as rows from phone_bridge_remote_data_chunks where command_id=$1",
      [commandId],
    );
    const count = counts[0];
    if (count && count.chunks === chunkCount && count.rows === totalCount) {
      await sql.query(
        "update phone_bridge_remote_commands set status='succeeded',result=$2::jsonb,error_message=null,completed_at=current_timestamp where id=$1 and status='running'",
        [commandId, JSON.stringify({ dataType, requestedCount: totalCount, receivedCount: count.rows, chunkCount })],
      );
      completed = true;
    }
  }

  return { ok: true, accepted: true, commandId, chunkIndex, completed };
});
