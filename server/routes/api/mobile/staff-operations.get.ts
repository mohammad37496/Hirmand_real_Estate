import { createError, defineEventHandler, getHeader, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";

function serializeDate(value: unknown) {
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  if (dbSource === "unconfigured") {
    return { success: true, tasks: [], visits: [], contacts: [], attendance: null, lostMode: false, generatedAt: new Date().toISOString() };
  }

  const device = await requireStaffMobileDevice(event);
  const sql = await getSql();

  const [taskRows, visitRows, contactRows, attendanceRows, deviceRows, captureRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      "select id,title,description,status,priority,property_id,customer_id,due_at,created_at,updated_at,completed_at " +
      "from staff_mobile_tasks where staff_id=$1 and status<>'cancelled' order by case when status='open' and due_at is not null and due_at < current_timestamp then 0 when status='in_progress' then 1 else 2 end, due_at asc nulls last limit 100",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,property_id,title,address,target_lat,target_lng,radius_m,scheduled_at,status,arrived_at,left_at,notes from staff_mobile_visits " +
      "where staff_id=$1 and status<>'cancelled' and (scheduled_at is null or scheduled_at >= current_timestamp - interval '7 days') order by scheduled_at asc nulls last limit 60",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,name,phone,type,notes,property_id,next_follow_up_at,updated_at from staff_mobile_crm_contacts where staff_id=$1 order by next_follow_up_at asc nulls last, updated_at desc limit 120",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,work_date,started_at,ended_at,start_lat,start_lng,end_lat,end_lng from staff_mobile_attendance where device_id=$1 and work_date=((current_timestamp at time zone 'Asia/Tehran')::date) limit 1",
      [device.device_id],
    ),
    sql.query<Record<string, unknown>>(
      "select lost_mode,lost_message,status,model,manufacturer,android_version,last_seen_at,last_sync_at from staff_mobile_devices where id=$1 limit 1",
      [device.id],
    ),
    sql.query<Record<string, unknown>>(
      "select c.id,c.property_id,c.visit_id,c.category,c.caption,c.created_at,f.name,f.mime_type,f.size_bytes from staff_mobile_property_captures c join staff_mobile_files f on f.id=c.file_id where c.staff_id=$1 order by c.created_at desc limit 30",
      [device.staff_id],
    ),
  ]);

  const attendance = attendanceRows[0] ?? null;
  const d = deviceRows[0] ?? {};
  return {
    success: true,
    generatedAt: new Date().toISOString(),
    device: {
      deviceId: device.device_id,
      staffId: device.staff_id,
      status: String(d.status ?? device.status ?? "pending"),
      model: String(d.model ?? ""),
      manufacturer: String(d.manufacturer ?? ""),
      androidVersion: String(d.android_version ?? ""),
      lastSeenAt: serializeDate(d.last_seen_at),
      lastSyncAt: serializeDate(d.last_sync_at),
    },
    lostMode: Boolean(d.lost_mode),
    lostMessage: String(d.lost_message ?? ""),
    tasks: taskRows.map((row) => ({
      id: String(row.id), title: String(row.title ?? ""), description: String(row.description ?? ""),
      status: String(row.status), priority: String(row.priority), propertyId: row.property_id ? String(row.property_id) : null,
      customerId: row.customer_id ? String(row.customer_id) : null, dueAt: serializeDate(row.due_at),
      createdAt: serializeDate(row.created_at), updatedAt: serializeDate(row.updated_at), completedAt: serializeDate(row.completed_at),
    })),
    visits: visitRows.map((row) => ({
      id: String(row.id), propertyId: row.property_id ? String(row.property_id) : null, title: String(row.title ?? ""),
      address: String(row.address ?? ""), targetLat: row.target_lat == null ? null : Number(row.target_lat),
      targetLng: row.target_lng == null ? null : Number(row.target_lng), radiusM: Number(row.radius_m ?? 120),
      scheduledAt: serializeDate(row.scheduled_at), status: String(row.status), arrivedAt: serializeDate(row.arrived_at),
      leftAt: serializeDate(row.left_at), notes: String(row.notes ?? ""),
    })),
    contacts: contactRows.map((row) => ({
      id: String(row.id), name: String(row.name ?? ""), phone: String(row.phone ?? ""), type: String(row.type ?? "customer"),
      notes: String(row.notes ?? ""), propertyId: row.property_id ? String(row.property_id) : null,
      nextFollowUpAt: serializeDate(row.next_follow_up_at),
    })),
    attendance: attendance ? {
      id: String(attendance.id), workDate: String(attendance.work_date ?? ""),
      startedAt: serializeDate(attendance.started_at), endedAt: serializeDate(attendance.ended_at),
      startLat: attendance.start_lat == null ? null : Number(attendance.start_lat),
      startLng: attendance.start_lng == null ? null : Number(attendance.start_lng),
      endLat: attendance.end_lat == null ? null : Number(attendance.end_lat),
      endLng: attendance.end_lng == null ? null : Number(attendance.end_lng),
    } : null,
    captures: captureRows.map((row) => ({
      id: String(row.id), propertyId: row.property_id ? String(row.property_id) : null,
      visitId: row.visit_id ? String(row.visit_id) : null, category: String(row.category ?? "general"),
      caption: String(row.caption ?? ""), createdAt: serializeDate(row.created_at),
      fileName: String(row.name ?? ""), mimeType: String(row.mime_type ?? ""), sizeBytes: Number(row.size_bytes ?? 0),
    })),
  };
});
