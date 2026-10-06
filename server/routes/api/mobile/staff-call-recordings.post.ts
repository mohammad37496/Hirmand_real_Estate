import { createError, defineEventHandler, getHeader, readRawBody, setResponseHeader } from "h3";
import { createHash, randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

const MAX_BYTES = 25 * 1024 * 1024;
const allowedMime = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/3gpp",
  "audio/amr",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

function clean(value: string | undefined, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function iso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function direction(value: string): "incoming" | "outgoing" | "unknown" {
  return value === "incoming" || value === "outgoing" ? value : "unknown";
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });
  }

  const device = await requireStaffMobileDevice(event);
  const rate = consumeStaffMobileRateLimit("staff-call-recording-upload", device.device_id, {
    windowMs: 10 * 60 * 1000,
    maxHits: 20,
  });
  if (!rate.allowed) {
    throw createError({ statusCode: 429, statusMessage: "تعداد ارسال فایل ضبط تماس بیش از حد مجاز است." });
  }

  const raw = await readRawBody(event);
  const bytes = raw ? Buffer.from(raw) : Buffer.alloc(0);
  if (!bytes.length || bytes.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "اندازه فایل صوتی مجاز نیست." });
  }

  const mime = clean(getHeader(event, "x-hirmand-file-mime") || getHeader(event, "content-type"), 80)
    .split(";")[0]
    .toLowerCase();
  if (!allowedMime.has(mime)) {
    throw createError({ statusCode: 415, statusMessage: "فرمت فایل صوتی مجاز نیست." });
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const declaredSha = clean(getHeader(event, "x-hirmand-file-sha256"), 64);
  if (declaredSha && declaredSha !== sha256) {
    throw createError({ statusCode: 422, statusMessage: "هش فایل صحیح نیست." });
  }

  const sourceCallId = clean(getHeader(event, "x-hirmand-source-call-id"), 120);
  const startedAt = iso(clean(getHeader(event, "x-hirmand-call-started-at"), 80));
  const endedAt = iso(clean(getHeader(event, "x-hirmand-call-ended-at"), 80));
  const callDirection = direction(clean(getHeader(event, "x-hirmand-call-direction"), 20));
  const phoneNumber = clean(getHeader(event, "x-hirmand-call-number"), 80);
  const contactName = clean(getHeader(event, "x-hirmand-call-contact"), 160);
  const rawDuration = Number(getHeader(event, "x-hirmand-call-duration") || 0);
  const callDuration = Number.isFinite(rawDuration) ? Math.max(0, Math.min(Math.trunc(rawDuration), 86400)) : 0;

  if (!startedAt) {
    throw createError({ statusCode: 400, statusMessage: "زمان شروع تماس ارسال نشده است." });
  }

  const sql = await getSql();

  const existing = await sql.query<{ id: string; file_id: string }>(
    "select id,file_id from staff_mobile_call_recordings where device_id=$1 and sha256=$2 limit 1",
    [device.device_id, sha256],
  );
  if (existing[0]) {
    return {
      success: true,
      duplicate: true,
      recordingId: existing[0].id,
      fileId: existing[0].file_id,
    };
  }

  const callRows = sourceCallId
    ? await sql.query<{ id: string }>(
        "select id from staff_mobile_calls where device_id=$1 and source_call_id=$2 limit 1",
        [device.device_id, sourceCallId],
      )
    : [];
  const callId = callRows[0]?.id ?? null;

  const fileId = randomUUID();
  const recordingId = randomUUID();
  const extension =
    mime.includes("wav") ? "wav" :
    mime.includes("ogg") ? "ogg" :
    mime.includes("webm") ? "webm" :
    mime.includes("3gpp") || mime.includes("amr") ? "3gp" :
    "m4a";
  const fileName = `hirmand-call-${recordingId}.${extension}`;

  await sql.query(
    `insert into staff_mobile_files
      (id,device_id,name,mime_type,size_bytes,sha256,content)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [fileId, device.device_id, fileName, mime, bytes.length, sha256, bytes],
  );

  await sql.query(
    `insert into staff_mobile_call_recordings
      (id,device_id,staff_id,call_id,file_id,source_call_id,call_started_at,call_ended_at,
       direction,phone_number,contact_name,duration_seconds,mime_type,size_bytes,sha256)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      recordingId,
      device.device_id,
      device.staff_id,
      callId,
      fileId,
      sourceCallId || null,
      startedAt,
      endedAt,
      callDirection,
      phoneNumber || null,
      contactName || null,
      callDuration,
      mime,
      bytes.length,
      sha256,
    ],
  );

  await sql.query(
    "insert into staff_mobile_ingest_log " +
      "(id,device_id,staff_id,endpoint,accepted_count,rejected_count) " +
      "values ($1,$2,$3,$4,$5,$6)",
    [randomUUID(), device.device_id, device.staff_id, "/api/mobile/staff-call-recordings", 1, 0],
  );

  return {
    success: true,
    duplicate: false,
    recordingId,
    fileId,
  };
});
