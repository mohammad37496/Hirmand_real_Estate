import { createError, defineEventHandler, getQuery, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

const TASK_STATUSES = new Set(["open", "in_progress", "done"]);
const VISIT_STATUSES = new Set(["planned", "arrived", "completed"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function iso(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function numberOrNull(value: unknown, min = -180, max = 180) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  if (dbSource === "unconfigured") return { success: true, skipped: true };

  const device = await requireStaffMobileDevice(event);
  const rate = consumeStaffMobileRateLimit("staff-operations", device.device_id, {
    windowMs: 10 * 60 * 1000, maxHits: 180,
  });
  if (!rate.allowed) throw createError({ statusCode: 429, statusMessage: "تعداد درخواست‌های عملیات دستگاه بیش از حد مجاز است." });

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>;
  const action = clean(body.action, 40);
  const sql = await getSql();

  if (action === "task_status") {
    const id = clean(body.id, 120);
    const status = clean(body.status, 30);
    if (!id || !TASK_STATUSES.has(status)) throw createError({ statusCode: 400, statusMessage: "وضعیت وظیفه نامعتبر است." });
    await sql.query(
      "update staff_mobile_tasks set status=$1,updated_at=current_timestamp,completed_at=case when $1='done' then current_timestamp else completed_at end where id=$2 and staff_id=$3",
      [status, id, device.staff_id],
    );
    return { success: true };
  }

  if (action === "visit_status") {
    const id = clean(body.id, 120);
    const status = clean(body.status, 30);
    if (!id || !VISIT_STATUSES.has(status)) throw createError({ statusCode: 400, statusMessage: "وضعیت بازدید نامعتبر است." });
    const lat = numberOrNull(body.latitude, -90, 90);
    const lng = numberOrNull(body.longitude, -180, 180);
    if (status === "arrived") {
      await sql.query(
        "update staff_mobile_visits set status='arrived',arrived_at=coalesce(arrived_at,current_timestamp),updated_at=current_timestamp,device_id=coalesce(device_id,$1) where id=$2 and staff_id=$3",
        [device.device_id, id, device.staff_id],
      );
      if (lat != null && lng != null) {
        await sql.query(
          "insert into staff_mobile_locations(id,device_id,staff_id,client_event_id,latitude,longitude,accuracy_m,altitude_m,speed_mps,provider,observed_at) values($1,$2,$3,$4,$5,$6,null,null,null,'visit-arrival',$7) on conflict (device_id,client_event_id) do nothing",
          [randomUUID(), device.device_id, device.staff_id, "visit-arrival:"+id+":"+Date.now(), lat, lng, new Date().toISOString()],
        );
      }
    } else if (status === "completed") {
      await sql.query("update staff_mobile_visits set status='completed',left_at=current_timestamp,updated_at=current_timestamp where id=$1 and staff_id=$2", [id, device.staff_id]);
    } else {
      await sql.query("update staff_mobile_visits set status='planned',updated_at=current_timestamp where id=$1 and staff_id=$2", [id, device.staff_id]);
    }
    return { success: true };
  }

  if (action === "attendance_start" || action === "attendance_stop") {
    const lat = numberOrNull(body.latitude, -90, 90);
    const lng = numberOrNull(body.longitude, -180, 180);
    const workDateSql = "((current_timestamp at time zone 'Asia/Tehran')::date)";
    if (action === "attendance_start") {
      await sql.query(
        "insert into staff_mobile_attendance(id,staff_id,device_id,work_date,started_at,start_lat,start_lng) values($1,$2,$3,"+workDateSql+",current_timestamp,$4,$5) on conflict (device_id,work_date) do update set started_at=coalesce(staff_mobile_attendance.started_at,current_timestamp),start_lat=coalesce(staff_mobile_attendance.start_lat,excluded.start_lat),start_lng=coalesce(staff_mobile_attendance.start_lng,excluded.start_lng),ended_at=null,updated_at=current_timestamp",
        [randomUUID(), device.staff_id, device.device_id, lat, lng],
      );
    } else {
      await sql.query(
        "update staff_mobile_attendance set ended_at=current_timestamp,end_lat=$3,end_lng=$4,updated_at=current_timestamp where device_id=$1 and work_date="+workDateSql,
        [device.device_id, device.staff_id, lat, lng],
      );
    }
    return { success: true };
  }

  if (action === "locations") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    let accepted = 0;
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const lat = numberOrNull(item.latitude, -90, 90);
      const lng = numberOrNull(item.longitude, -180, 180);
      const observedAt = iso(item.observedAt);
      const eventId = clean(item.clientEventId, 120);
      if (lat == null || lng == null || !observedAt || !eventId) continue;
      const rows = await sql.query(
        "insert into staff_mobile_locations(id,device_id,staff_id,client_event_id,latitude,longitude,accuracy_m,altitude_m,speed_mps,provider,observed_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (device_id,client_event_id) do nothing returning id",
        [randomUUID(), device.device_id, device.staff_id, eventId, lat, lng,
          numberOrNull(item.accuracyM, 0, 100000) ?? null, numberOrNull(item.altitudeM, -100000, 100000) ?? null,
          numberOrNull(item.speedMps, 0, 500) ?? null, clean(item.provider, 40), observedAt],
      );
      if (rows.length) accepted++;
    }
    await sql.query("update staff_mobile_devices set last_seen_at=current_timestamp,last_sync_at=current_timestamp where id=$1", [device.id]);
    return { success: true, accepted };
  }

  if (action === "health") {
    const payload = body.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw createError({ statusCode: 400, statusMessage: "داده سلامت دستگاه نامعتبر است." });
    }
    const observedAt = iso(body.observedAt) ?? new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    if (payloadJson.length > 24000) throw createError({ statusCode: 413, statusMessage: "حجم داده سلامت دستگاه زیاد است." });
    await sql.query(
      "insert into staff_mobile_health(id,device_id,staff_id,payload,observed_at) values($1,$2,$3,$4::jsonb,$5) on conflict (device_id) do update set staff_id=excluded.staff_id,payload=excluded.payload,observed_at=excluded.observed_at,received_at=current_timestamp",
      [randomUUID(), device.device_id, device.staff_id, payloadJson, observedAt],
    );
    await sql.query("update staff_mobile_devices set last_seen_at=current_timestamp,last_sync_at=current_timestamp where id=$1", [device.id]);
    return { success: true };
  }

  if (action === "crm_interaction") {
    const contactId = clean(body.contactId, 120);
    const kind = new Set(["call","meeting","note","message","calendar"]).has(clean(body.kind, 30)) ? clean(body.kind, 30) : "note";
    const note = clean(body.note, 1000);
    if (!contactId) throw createError({ statusCode: 400, statusMessage: "مخاطب نامعتبر است." });
    const contact = await sql.query("select id from staff_mobile_crm_contacts where id=$1 and staff_id=$2 limit 1", [contactId, device.staff_id]);
    if (!contact[0]) throw createError({ statusCode: 404, statusMessage: "مخاطب پیدا نشد." });
    await sql.query(
      "insert into staff_mobile_crm_interactions(id,contact_id,staff_id,kind,note) values($1,$2,$3,$4,$5)",
      [randomUUID(), contactId, device.staff_id, kind, note],
    );
    await sql.query("update staff_mobile_crm_contacts set updated_at=current_timestamp where id=$1 and staff_id=$2", [contactId, device.staff_id]);
    return { success: true };
  }

  if (action === "calendar_logged") return { success: true };

  throw createError({ statusCode: 400, statusMessage: "عملیات هیرمند شناخته نشد." });
});
