import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

const TASK_STATUSES = new Set(["open", "in_progress", "done"]);
const VISIT_STATUSES = new Set(["planned", "arrived", "completed"]);
const CRM_TYPES = new Set(["owner", "buyer", "tenant", "builder", "partner", "customer", "other"]);
const CRM_RELATIONS = new Set(["interested", "viewing", "owner", "buyer", "tenant", "seller", "related"]);

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
  const clientEventId = clean(body.clientEventId, 120) || randomUUID();
  const eventRows = await sql.query<{ event_id: string }>(
    "insert into staff_mobile_sync_events(event_id,device_id,staff_id,action,payload) values($1,$2,$3,$4,$5::jsonb) " +
    "on conflict(event_id) do nothing returning event_id",
    [clientEventId, device.device_id, device.staff_id, action || "unknown", JSON.stringify(body)],
  );
  if (!eventRows.length) return { success: true, deduplicated: true, clientEventId };

  const touchDevice = async () => {
    await sql.query("update staff_mobile_devices set last_seen_at=current_timestamp,last_sync_at=current_timestamp where id=$1", [device.id]);
  };

  if (action === "task_status") {
    const id = clean(body.id, 120);
    const status = clean(body.status, 30);
    if (!id || !TASK_STATUSES.has(status)) throw createError({ statusCode: 400, statusMessage: "وضعیت وظیفه نامعتبر است." });
    await sql.query(
      "update staff_mobile_tasks set status=$1,updated_at=current_timestamp,completed_at=case when $1='done' then current_timestamp else completed_at end where id=$2 and staff_id=$3",
      [status, id, device.staff_id],
    );
    await touchDevice();
    return { success: true, clientEventId };
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
          [randomUUID(), device.device_id, device.staff_id, "visit-arrival:"+id+":"+clientEventId, lat, lng, new Date().toISOString()],
        );
      }
    } else if (status === "completed") {
      await sql.query("update staff_mobile_visits set status='completed',left_at=current_timestamp,updated_at=current_timestamp where id=$1 and staff_id=$2", [id, device.staff_id]);
    } else {
      await sql.query("update staff_mobile_visits set status='planned',updated_at=current_timestamp where id=$1 and staff_id=$2", [id, device.staff_id]);
    }
    await touchDevice();
    return { success: true, clientEventId };
  }

  if (action === "attendance_start" || action === "attendance_stop") {
    const lat = numberOrNull(body.latitude, -90, 90);
    const lng = numberOrNull(body.longitude, -180, 180);
    const workDateSql = "((current_timestamp at time zone 'Asia/Tehran')::date)";
    if (action === "attendance_start") {
      await sql.query(
        "insert into staff_mobile_attendance(id,staff_id,device_id,work_date,started_at,start_lat,start_lng) values($1,$2,$3,"+workDateSql+",current_timestamp,$4,$5) " +
        "on conflict (device_id,work_date) do update set started_at=coalesce(staff_mobile_attendance.started_at,current_timestamp),start_lat=coalesce(staff_mobile_attendance.start_lat,excluded.start_lat),start_lng=coalesce(staff_mobile_attendance.start_lng,excluded.start_lng),ended_at=null,updated_at=current_timestamp",
        [randomUUID(), device.staff_id, device.device_id, lat, lng],
      );
    } else {
      await sql.query(
        "update staff_mobile_attendance set ended_at=current_timestamp,end_lat=$3,end_lng=$4,updated_at=current_timestamp where device_id=$1 and work_date="+workDateSql,
        [device.device_id, device.staff_id, lat, lng],
      );
    }
    await touchDevice();
    return { success: true, clientEventId };
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
    await touchDevice();
    return { success: true, accepted, clientEventId };
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
      "insert into staff_mobile_health(id,device_id,staff_id,payload,observed_at) values($1,$2,$3,$4::jsonb,$5) " +
      "on conflict (device_id) do update set staff_id=excluded.staff_id,payload=excluded.payload,observed_at=excluded.observed_at,received_at=current_timestamp",
      [randomUUID(), device.device_id, device.staff_id, payloadJson, observedAt],
    );
    await touchDevice();
    return { success: true, clientEventId };
  }

  if (action === "crm_interaction") {
    const contactId = clean(body.contactId, 120);
    const kindRaw = clean(body.kind, 30);
    const kind = new Set(["call", "meeting", "note", "message", "calendar"]).has(kindRaw) ? kindRaw : "note";
    const note = clean(body.note, 1000);
    const followUpAt = body.followUpAt == null || body.followUpAt === "" ? null : iso(body.followUpAt);
    if (!contactId) throw createError({ statusCode: 400, statusMessage: "مخاطب نامعتبر است." });
    const contactRows = await sql.query<{ id:string; lead_id:string|null; name:string; property_id:string|null }>(
      "select id,lead_id,name,property_id from staff_mobile_crm_contacts where id=$1 and staff_id=$2 limit 1",
      [contactId, device.staff_id],
    );
    const contact = contactRows[0];
    if (!contact) throw createError({ statusCode: 404, statusMessage: "مخاطب پیدا نشد." });

    await sql.query(
      "insert into staff_mobile_crm_interactions(id,contact_id,staff_id,kind,note) values($1,$2,$3,$4,$5)",
      [randomUUID(), contactId, device.staff_id, kind, note],
    );
    await sql.query(
      "update staff_mobile_crm_contacts set updated_at=current_timestamp," +
      "next_follow_up_at=case when $1::timestamptz is not null then $1 else next_follow_up_at end where id=$2 and staff_id=$3",
      [followUpAt, contactId, device.staff_id],
    );

    if (contact.lead_id) {
      const activityType = kind === "calendar" ? "note" : kind;
      await sql.query(
        "insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,$2,$3,$4,$5::jsonb)",
        [String(contact.lead_id), activityType, "فعالیت CRM کارمند · " + String(contact.name), note, JSON.stringify({ source:"staff_mobile", clientEventId, propertyId:contact.property_id })],
      ).catch(() => {});
      await sql.query(
        "update leads set last_contacted_at=case when $1 in ('call','message','meeting') then current_timestamp else last_contacted_at end," +
        "follow_up_at=case when $2::timestamptz is not null then $2 else follow_up_at end," +
        "status=case when status='new' and $1 in ('call','message','meeting') then 'contacted' else status end," +
        "updated_at=current_timestamp where id=$3",
        [kind, followUpAt, String(contact.lead_id)],
      ).catch(() => {});
    }
    await touchDevice();
    return { success: true, clientEventId };
  }

  if (action === "calendar_logged") {
    await touchDevice();
    return { success: true, clientEventId };
  }

  if (action === "crm_create_contact") {
    const name = clean(body.name, 180);
    const phone = clean(body.phone, 80);
    const leadId = clean(body.leadId, 120) || null;
    if (!name) throw createError({ statusCode: 400, statusMessage: "نام مخاطب الزامی است." });
    const typeRaw = clean(body.type, 30);
    const type = CRM_TYPES.has(typeRaw) ? typeRaw : "customer";
    if (leadId) {
      const lead = await sql.query("select id from leads where id=$1 limit 1", [leadId]);
      if (!lead[0]) throw createError({ statusCode: 404, statusMessage: "لید انتخاب‌شده پیدا نشد." });
    }
    let leadPropertyIdForContact="";
    if(leadId){
      const lead=await sql.query<{id:string;property_id:string|null}>("select id,property_id from leads where id=$1 limit 1",[leadId]);
      if(!lead[0])throw createError({statusCode:404,statusMessage:"لید انتخاب‌شده پیدا نشد."});
      leadPropertyIdForContact=lead[0].property_id?String(lead[0].property_id):"";
    }
    const propertyIds = Array.isArray(body.propertyIds)
      ? body.propertyIds.map((value) => clean(value, 160)).filter(Boolean).slice(0, 20)
      : [];
    if (clean(body.propertyId,160)) propertyIds.unshift(clean(body.propertyId,160));
    if (leadPropertyIdForContact) propertyIds.unshift(leadPropertyIdForContact);
    const uniquePropertyIds = [...new Set(propertyIds)];
    if (uniquePropertyIds.length) {
      const rows = await sql.query<{id:string}>("select id from properties where id = any($1::text[])", [uniquePropertyIds]);
      const valid = new Set(rows.map((row) => String(row.id)));
      if (valid.size !== uniquePropertyIds.length) throw createError({ statusCode: 404, statusMessage: "یکی از فایل‌های انتخاب‌شده پیدا نشد." });
    }
    const id = clean(body.entityId, 120) || randomUUID();
    await sql.query(
      "insert into staff_mobile_crm_contacts(id,staff_id,name,phone,type,notes,lead_id,property_id,next_follow_up_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id, device.staff_id, name, phone, type, clean(body.notes, 1200), leadId, uniquePropertyIds[0] || null, iso(body.nextFollowUpAt)],
    );
    for (const propertyId of uniquePropertyIds) {
      await sql.query(
        "insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,$3) on conflict(contact_id,property_id) do update set updated_at=current_timestamp",
        [id, propertyId, CRM_RELATIONS.has(clean(body.relationType,30)) ? clean(body.relationType,30) : "interested"],
      );
    }
    await touchDevice();
    return { success: true, id, clientEventId };
  }

  if (action === "crm_link") {
    const contactId = clean(body.contactId, 120);
    if (!contactId) throw createError({ statusCode:400,statusMessage:"مخاطب مشخص نیست."});
    const contact = await sql.query("select id from staff_mobile_crm_contacts where id=$1 and staff_id=$2 limit 1",[contactId,device.staff_id]);
    if (!contact[0]) throw createError({ statusCode:404,statusMessage:"مخاطب پیدا نشد."});

    const leadId = clean(body.leadId,120) || null;
    if (leadId) {
      const lead = await sql.query("select id,property_id from leads where id=$1 limit 1",[leadId]);
      if (!lead[0]) throw createError({statusCode:404,statusMessage:"لید انتخاب‌شده پیدا نشد."});
      await sql.query("update staff_mobile_crm_contacts set lead_id=$1,property_id=coalesce(property_id,$2),updated_at=current_timestamp where id=$3 and staff_id=$4",[leadId,lead[0].property_id?String(lead[0].property_id):null,contactId,device.staff_id]);
      if (lead[0].property_id) await sql.query("insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,'interested') on conflict(contact_id,property_id) do update set updated_at=current_timestamp",[contactId,String(lead[0].property_id)]);
    }

    const replace = Boolean(body.replaceProperties);
    const propertyIds = Array.isArray(body.propertyIds) ? [...new Set(body.propertyIds.map(v=>clean(v,160)).filter(Boolean))].slice(0,20) : [];
    if (replace) await sql.query("delete from staff_mobile_crm_contact_properties where contact_id=$1",[contactId]);
    if (propertyIds.length) {
      const rows = await sql.query<{id:string}>("select id from properties where id=any($1::text[])",[propertyIds]);
      const valid = new Set(rows.map(r=>String(r.id)));
      if (valid.size!==propertyIds.length) throw createError({statusCode:404,statusMessage:"یکی از فایل‌های انتخاب‌شده پیدا نشد."});
      for(const propertyId of propertyIds){
        await sql.query("insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,$3) on conflict(contact_id,property_id) do update set relation_type=excluded.relation_type,updated_at=current_timestamp",[contactId,propertyId,CRM_RELATIONS.has(clean(body.relationType,30))?clean(body.relationType,30):"interested"]);
      }
    }
    await touchDevice();
    return {success:true,clientEventId};
  }

  throw createError({ statusCode: 400, statusMessage: "عملیات هیرمند شناخته نشد." });
});
