import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";
import { recalculateLeadScore } from "@/lib/lead-scoring.server";

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

function normalizePhone(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^0-9]/g, "")
    .replace(/^98/, "0");
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

const inserted = await sql.query(
      `insert into staff_mobile_calls
        (id,device_id,staff_id,source_call_id,phone_number,contact_name,direction,occurred_at,duration_seconds)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (device_id,source_call_id) do nothing
       returning id`,
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

    if (inserted.length && number) {
      const normalized = normalizePhone(number);
      if (normalized) {
        const contacts = await sql.query<{ id:string; lead_id:string|null; name:string }>(
          "select id,lead_id,name from staff_mobile_crm_contacts where staff_id=$1 and regexp_replace(phone,'[^0-9]','','g')=any($2::text[]) order by updated_at desc limit 1",
          [
            device.staff_id,
            [normalized, normalized.replace(/^0/, "98"), "98"+normalized.replace(/^0/, "")],
          ],
        );
        const contact = contacts[0];
        if (contact) {
          const interactionId = randomUUID();
          const directionLabel = direction === "outgoing" ? "تماس خروجی" : direction === "incoming" ? "تماس ورودی" : direction === "missed" ? "تماس بی‌پاسخ" : "ثبت تماس";
          await sql.query(
            "insert into staff_mobile_crm_interactions(id,contact_id,staff_id,kind,note) values($1,$2,$3,'call',$4)",
            [
              interactionId,
              contact.id,
              device.staff_id,
              directionLabel+" · "+duration+" ثانیه · "+occurredAt,
            ],
          );
          await sql.query(
            "update staff_mobile_crm_contacts set updated_at=current_timestamp where id=$1 and staff_id=$2",
            [contact.id,device.staff_id],
          );
          if(contact.lead_id){
            await recalculateLeadScore(sql,String(contact.lead_id)).catch(()=>null);
            await sql.query(
              "insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'call',$2,$3,$4::jsonb)",
              [contact.lead_id,directionLabel,"تماس خودکار از اپ کارکنان · "+contact.name,JSON.stringify({source:"staff_mobile_call_sync",direction,durationSeconds:duration})],
            ).catch(()=>{});
            if(direction==="outgoing"||direction==="incoming"){
              await sql.query(
                "update leads set last_contacted_at=greatest(coalesce(last_contacted_at,to_timestamp(0)),to_timestamp($1)),status=case when status='new' then 'contacted' else status end,updated_at=current_timestamp where id=$2",
                [Math.floor(new Date(occurredAt).getTime()/1000),contact.lead_id],
              ).catch(()=>{});
            }
          }
        }
      }
    }

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
