import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

type CallItem = {
  sourceId?: unknown;
  number?: unknown;
  contactName?: unknown;
  type?: unknown;
  dateMs?: unknown;
  durationSeconds?: unknown;
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function callDirection(raw: unknown): "incoming" | "outgoing" | "missed" | "rejected" | "blocked" | "other" {
  switch (Number(raw)) {
    case 1: return "incoming";
    case 2: return "outgoing";
    case 3: return "missed";
    case 5: return "rejected";
    case 6: return "blocked";
    default: return "other";
  }
}

function isoFromEpochMs(value: unknown): string | null {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function durationSeconds(value: unknown): number {
  const raw = Number(value);
  return Number.isFinite(raw) ? Math.max(0, Math.min(Math.trunc(raw), 86400)) : 0;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });
  }

  const device = await requireStaffMobileDevice(event);
  const rate = consumeStaffMobileRateLimit("staff-call-sync", device.device_id, {
    windowMs: 10 * 60 * 1000,
    maxHits: 30,
  });
  if (!rate.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: "تعداد همگام‌سازی تماس‌ها بیش از حد مجاز است.",
    });
  }

  const body = await readBody(event).catch(() => ({})) as { calls?: unknown };
  const items = Array.isArray(body.calls) ? body.calls.slice(0, 500) as CallItem[] : [];
  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: "فهرست تماس برای همگام‌سازی ارسال نشده است." });
  }

  const sql = await getSql();
  let accepted = 0;
  let rejected = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") {
      rejected++;
      continue;
    }

    const sourceId = cleanText(item.sourceId, 120);
    const occurredAt = isoFromEpochMs(item.dateMs);
    if (!sourceId || !occurredAt) {
      rejected++;
      continue;
    }

    const number = cleanText(item.number, 80);
    const contactName = cleanText(item.contactName, 160);
    const direction = callDirection(item.type);
    const duration = durationSeconds(item.durationSeconds);

    await sql.query(
      `insert into staff_mobile_calls
        (id,device_id,staff_id,source_call_id,phone_number,contact_name,direction,occurred_at,duration_seconds)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (device_id,source_call_id)
       do update set
         staff_id=excluded.staff_id,
         phone_number=excluded.phone_number,
         contact_name=excluded.contact_name,
         direction=excluded.direction,
         occurred_at=excluded.occurred_at,
         duration_seconds=excluded.duration_seconds`,
      [
        randomUUID(),
        device.device_id,
        device.staff_id,
        sourceId,
        number || null,
        contactName || null,
        direction,
        occurredAt,
        duration,
      ],
    );

    accepted++;
  }

  await sql.query(
    "insert into staff_mobile_ingest_log " +
      "(id,device_id,staff_id,endpoint,accepted_count,rejected_count) " +
      "values ($1,$2,$3,$4,$5,$6)",
    [randomUUID(), device.device_id, device.staff_id, "/api/mobile/staff-calls", accepted, rejected],
  );

  await sql.query(
    "update staff_mobile_devices set last_seen_at=current_timestamp,last_sync_at=current_timestamp where id=$1",
    [device.id],
  );

  return {
    success: true,
    accepted,
    rejected,
    remainingRateLimit: rate.remaining,
  };
});
