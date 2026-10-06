import { defineEventHandler, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { runStaffFollowUpAutomation } from "@/lib/staff-automation.server";

function serializeDate(value: unknown) {
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function numberValue(value: unknown) {
  return Number(value) || 0;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  if (dbSource === "unconfigured") {
    return {
      success: true,
      tasks: [],
      visits: [],
      contacts: [],
      interactions: [],
      attendance: null,
      lostMode: false,
      captures: [],
      followUps: [],
      daily: {
        tasksToday: 0, tasksDoneToday: 0, overdueTasks: 0, visitsToday: 0, visitsDoneToday: 0,
        callsToday: 0, followUpsDue: 0, followUpsNext7: 0, capturesToday: 0,
      },
      performance: { score: 0, tasksDone: 0, visitsDone: 0, callsDone: 0, attendanceDays: 0, interactions: 0 },
      generatedAt: new Date().toISOString(),
    };
  }

  const device = await requireStaffMobileDevice(event);
  const sql = await getSql();

  await runStaffFollowUpAutomation(sql, { staffId: device.staff_id, limitPerStaff: 30 }).catch(() => ({ created: 0, overdue: 0 }));

  const [staffRows, taskRows, visitRows, contactRows, interactionRows, attendanceRows, deviceRows, captureRows, followUpRows, dailyRows, performanceRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      "select id,name,role from consultants where id=$1 limit 1",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,title,description,status,priority,property_id,customer_id,due_at,created_at,updated_at,completed_at " +
      "from staff_mobile_tasks where staff_id=$1 and status<>'cancelled' " +
      "order by case when status='open' and due_at is not null and due_at < current_timestamp then 0 " +
      "when status='in_progress' then 1 else 2 end, due_at asc nulls last limit 100",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,property_id,title,address,target_lat,target_lng,radius_m,scheduled_at,status,arrived_at,left_at,notes,outcome,customer_interest_score,customer_feedback,next_follow_up_at,checklist,checklist_completed_at " +
      "from staff_mobile_visits where staff_id=$1 and status<>'cancelled' and " +
      "(scheduled_at is null or scheduled_at >= current_timestamp - interval '7 days') " +
      "order by scheduled_at asc nulls last limit 60",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select c.id,c.name,c.phone,c.type,c.notes,c.lead_id,c.property_id,c.next_follow_up_at,c.updated_at," +
      "l.name as lead_name,l.status as lead_status,l.deal as lead_deal,l.follow_up_at as lead_follow_up_at,l.lead_score,l.lead_score_band,l.matched_properties," +
      "coalesce(json_agg(distinct jsonb_build_object(" +
      "'id',p.id,'title',p.title,'slug',p.slug,'neighborhood',p.neighborhood,'areaM2',p.area_m2," +
      "'bedrooms',p.bedrooms,'transactionType',p.transaction_type,'propertyType',p.property_type" +
      ")) filter(where p.id is not null),'[]'::json) as linked_properties " +
      "from staff_mobile_crm_contacts c " +
      "left join leads l on l.id=c.lead_id " +
      "left join staff_mobile_crm_contact_properties cp on cp.contact_id=c.id " +
      "left join properties p on p.id=cp.property_id " +
      "where c.staff_id=$1 " +
      "group by c.id,l.name,l.status,l.deal,l.follow_up_at,l.lead_score,l.lead_score_band,l.matched_properties " +
      "order by c.next_follow_up_at asc nulls last,c.updated_at desc limit 120",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,contact_id,kind,note,created_at from staff_mobile_crm_interactions " +
      "where staff_id=$1 order by created_at desc limit 150",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select id,work_date,started_at,ended_at,start_lat,start_lng,end_lat,end_lng " +
      "from staff_mobile_attendance where device_id=$1 and work_date=((current_timestamp at time zone 'Asia/Tehran')::date) limit 1",
      [device.device_id],
    ),
    sql.query<Record<string, unknown>>(
      "select lost_mode,lost_message,status,model,manufacturer,android_version,last_seen_at,last_sync_at " +
      "from staff_mobile_devices where id=$1 limit 1",
      [device.id],
    ),
    sql.query<Record<string, unknown>>(
      "select c.id,c.property_id,c.visit_id,c.category,c.caption,c.created_at,f.name,f.mime_type,f.size_bytes " +
      "from staff_mobile_property_captures c join staff_mobile_files f on f.id=c.file_id " +
      "where c.staff_id=$1 order by c.created_at desc limit 30",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select c.id,c.name,c.phone,c.type,c.lead_id,c.property_id,c.next_follow_up_at,l.status as lead_status,p.title as property_title " +
      "from staff_mobile_crm_contacts c left join leads l on l.id=c.lead_id left join properties p on p.id=c.property_id " +
      "where c.staff_id=$1 and c.next_follow_up_at is not null and c.next_follow_up_at <= current_timestamp + interval '7 days' " +
      "order by c.next_follow_up_at asc limit 20",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select " +
      "count(*) filter(where due_at is not null and due_at >= ((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') " +
      "and due_at < (((current_timestamp at time zone 'Asia/Tehran')::date + 1) at time zone 'Asia/Tehran'))::int as tasks_today," +
      "count(*) filter(where completed_at is not null and completed_at >= ((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') " +
      "and completed_at < (((current_timestamp at time zone 'Asia/Tehran')::date + 1) at time zone 'Asia/Tehran'))::int as tasks_done_today," +
      "count(*) filter(where status in('open','in_progress') and due_at is not null and due_at < current_timestamp)::int as overdue_tasks " +
      "from staff_mobile_tasks where staff_id=$1 and status<>'cancelled';",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "with today as (" +
      "select ((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') as start_at, " +
      "(((current_timestamp at time zone 'Asia/Tehran')::date + 1) at time zone 'Asia/Tehran') as end_at) " +
      "select " +
      "(select count(*)::int from staff_mobile_visits,today where staff_id=$1 and scheduled_at>=today.start_at and scheduled_at<today.end_at) as visits_today," +
      "(select count(*)::int from staff_mobile_visits,today where staff_id=$1 and status='completed' and left_at>=today.start_at and left_at<today.end_at) as visits_done_today," +
      "(select count(*)::int from staff_mobile_calls,today where staff_id=$1 and occurred_at>=today.start_at and occurred_at<today.end_at) as calls_today," +
      "(select count(*)::int from staff_mobile_crm_contacts where staff_id=$1 and next_follow_up_at is not null and next_follow_up_at<=current_timestamp) as followups_due," +
      "(select count(*)::int from staff_mobile_crm_contacts where staff_id=$1 and next_follow_up_at is not null and next_follow_up_at>current_timestamp and next_follow_up_at<=current_timestamp+interval '7 days') as followups_next7," +
      "(select count(*)::int from staff_mobile_property_captures,today where staff_id=$1 and created_at>=today.start_at and created_at<today.end_at) as captures_today",
      [device.staff_id],
    ),
    sql.query<Record<string, unknown>>(
      "select " +
      "(select count(*) from staff_mobile_tasks where staff_id=$1 and status='done' and completed_at>=current_timestamp-interval '30 days')::int as tasks_done," +
      "(select count(*) from staff_mobile_visits where staff_id=$1 and status='completed' and left_at>=current_timestamp-interval '30 days')::int as visits_done," +
      "(select count(*) from staff_mobile_calls where staff_id=$1 and occurred_at>=current_timestamp-interval '30 days')::int as calls_done," +
      "(select count(*) from staff_mobile_attendance where staff_id=$1 and started_at>=current_timestamp-interval '30 days')::int as attendance_days," +
      "(select count(*) from staff_mobile_crm_interactions where staff_id=$1 and created_at>=current_timestamp-interval '30 days')::int as interactions",
      [device.staff_id],
    ),
  ]);

  const attendance = attendanceRows[0] ?? null;
  const d = deviceRows[0] ?? {};
  const perf = performanceRows[0] ?? {};
  const tasksDone = numberValue(perf.tasks_done);
  const visitsDone = numberValue(perf.visits_done);
  const callsDone = numberValue(perf.calls_done);
  const attendanceDays = numberValue(perf.attendance_days);
  const interactions = numberValue(perf.interactions);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    staff: staffRows[0] ? {
      id: String(staffRows[0].id),
      name: String(staffRows[0].name ?? ""),
      role: String(staffRows[0].role ?? ""),
    } : { id: device.staff_id, name: "", role: "" },
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
      outcome: String(row.outcome ?? "pending"),
      customerInterestScore: row.customer_interest_score == null ? null : Number(row.customer_interest_score),
      customerFeedback: String(row.customer_feedback ?? ""),
      nextFollowUpAt: serializeDate(row.next_follow_up_at),
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      checklistCompletedAt: serializeDate(row.checklist_completed_at),
    })),
    contacts: contactRows.map((row) => ({
      id: String(row.id), name: String(row.name ?? ""), phone: String(row.phone ?? ""), type: String(row.type ?? "customer"),
      notes: String(row.notes ?? ""), leadId: row.lead_id ? String(row.lead_id) : null,
      leadStatus: row.lead_status ? String(row.lead_status) : null,
      leadDeal: row.lead_deal ? String(row.lead_deal) : null,
      leadScore: row.lead_score == null ? 0 : Number(row.lead_score),
      leadScoreBand: String(row.lead_score_band ?? "cold"),
      recommendedProperties: Array.isArray(row.matched_properties) ? row.matched_properties.slice(0, 6) : [],
      propertyId: row.property_id ? String(row.property_id) : null,
      nextFollowUpAt: serializeDate(row.next_follow_up_at ?? row.lead_follow_up_at),
      linkedProperties: Array.isArray(row.linked_properties) ? row.linked_properties : [],
    })),
    interactions: interactionRows.map((row) => ({
      id: String(row.id), contactId: String(row.contact_id), kind: String(row.kind ?? "note"),
      note: String(row.note ?? ""), createdAt: serializeDate(row.created_at),
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
    followUps: followUpRows.map((row) => ({
      id: String(row.id), name: String(row.name ?? ""), phone: String(row.phone ?? ""),
      type: String(row.type ?? "customer"), leadId: row.lead_id ? String(row.lead_id) : null,
      propertyId: row.property_id ? String(row.property_id) : null,
      propertyTitle: row.property_title ? String(row.property_title) : null,
      leadStatus: row.lead_status ? String(row.lead_status) : null,
      nextFollowUpAt: serializeDate(row.next_follow_up_at),
    })),
    daily: {
      tasksToday: numberValue(dailyRows[0]?.tasks_today),
      tasksDoneToday: numberValue(dailyRows[0]?.tasks_done_today),
      overdueTasks: numberValue(dailyRows[0]?.overdue_tasks),
      visitsToday: numberValue(dailyRows[0]?.visits_today),
      visitsDoneToday: numberValue(dailyRows[0]?.visits_done_today),
      callsToday: numberValue(dailyRows[0]?.calls_today),
      followUpsDue: numberValue(dailyRows[0]?.followups_due),
      followUpsNext7: numberValue(dailyRows[0]?.followups_next7),
      capturesToday: numberValue(dailyRows[0]?.captures_today),
    },
    performance: {
      score: tasksDone * 2 + visitsDone * 3 + callsDone + attendanceDays * 2 + interactions,
      tasksDone,
      visitsDone,
      callsDone,
      attendanceDays,
      interactions,
    },
  };
});
