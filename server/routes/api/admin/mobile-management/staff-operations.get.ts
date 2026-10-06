import { createError, defineEventHandler, getCookie, setResponseHeader, type H3Event } from "h3";
import { getSql, dbSource } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminSessionClaims, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireSecurityAdmin(event:H3Event){
  const token=getCookie(event,ADMIN_SESSION_COOKIE);
  if(!(await verifyAdminSessionToken(token))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست."});
  assertSameOrigin(event);
  const claims=await getAdminSessionClaims(token);
  if(!hasAdminPermission(normalizeAdminRole(claims?.role),"security.manage")) throw createError({statusCode:403,statusMessage:"مجوز مدیریت عملیات کارکنان برای این حساب فعال نیست."});
}

function dateOrNull(v:unknown){if(v==null||v==="")return null;const d=new Date(String(v));return Number.isFinite(d.getTime())?d.toISOString():null}
function s(v:unknown,max=240){return typeof v==="string"?v.trim().slice(0,max):""}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","private, no-store");
  await requireSecurityAdmin(event);
  if(dbSource==="unconfigured") return {success:true,staff:[],devices:[],tasks:[],visits:[],contacts:[],attendance:[],captures:[],health:[],stats:{}};
  const sql=await getSql();
  const [staff,devices,tasks,visits,contacts,attendance,captures,health,calls,recordings]=await Promise.all([
    sql.query<Record<string,unknown>>("select id,name,role from consultants where is_active=true order by sort_order asc,name asc"),
    sql.query<Record<string,unknown>>("select d.id,d.device_id,d.staff_id,coalesce(c.name,'کارمند ناشناس') as staff_name,d.status,d.model,d.manufacturer,d.android_version,d.management_mode,d.last_seen_at,d.last_sync_at,d.lost_mode,d.lost_message from staff_mobile_devices d left join consultants c on c.id=d.staff_id order by c.sort_order asc nulls last,c.name asc,d.updated_at desc"),
    sql.query<Record<string,unknown>>("select t.id,t.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,t.title,t.description,t.status,t.priority,t.property_id,t.customer_id,t.due_at,t.created_at,t.updated_at from staff_mobile_tasks t left join consultants c on c.id=t.staff_id where t.status<>'cancelled' order by t.due_at asc nulls last,t.created_at desc limit 300"),
    sql.query<Record<string,unknown>>("select v.id,v.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,v.property_id,v.title,v.address,v.target_lat,v.target_lng,v.radius_m,v.scheduled_at,v.status,v.arrived_at,v.left_at,v.notes from staff_mobile_visits v left join consultants c on c.id=v.staff_id where v.status<>'cancelled' order by v.scheduled_at asc nulls last limit 240"),
    sql.query<Record<string,unknown>>("select id,staff_id,name,phone,type,notes,property_id,next_follow_up_at,updated_at from staff_mobile_crm_contacts order by next_follow_up_at asc nulls last,updated_at desc limit 300"),
    sql.query<Record<string,unknown>>("select a.id,a.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,a.device_id,a.work_date,a.started_at,a.ended_at from staff_mobile_attendance a left join consultants c on c.id=a.staff_id order by a.work_date desc,a.started_at desc nulls last limit 200"),
    sql.query<Record<string,unknown>>("select x.id,x.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,x.device_id,x.property_id,x.visit_id,x.category,x.caption,x.created_at,f.name file_name,f.mime_type,f.size_bytes from staff_mobile_property_captures x left join consultants c on c.id=x.staff_id join staff_mobile_files f on f.id=x.file_id order by x.created_at desc limit 200"),
    sql.query<Record<string,unknown>>("select h.device_id,h.staff_id,h.payload,h.observed_at,h.received_at from staff_mobile_health h order by h.observed_at desc"),
    sql.query<{count:number}[]>("select count(*)::int count from staff_mobile_calls where occurred_at>=current_timestamp-interval '1 day'"),
    sql.query<{count:number}[]>("select count(*)::int count from staff_mobile_call_recordings where created_at>=current_timestamp-interval '1 day'"),
  ]);

  const mapDate=dateOrNull;
  return {
    success:true,generatedAt:new Date().toISOString(),
    staff:staff.map(r=>({id:String(r.id),name:String(r.name??""),role:String(r.role??"")})),
    devices:devices.map(r=>({id:String(r.id),deviceId:String(r.device_id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),status:String(r.status??""),model:String(r.model??""),manufacturer:String(r.manufacturer??""),androidVersion:String(r.android_version??""),managementMode:String(r.management_mode??""),lastSeenAt:mapDate(r.last_seen_at),lastSyncAt:mapDate(r.last_sync_at),lostMode:Boolean(r.lost_mode),lostMessage:String(r.lost_message??"")})),
    tasks:tasks.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),title:String(r.title??""),description:String(r.description??""),status:String(r.status),priority:String(r.priority),propertyId:r.property_id?String(r.property_id):null,customerId:r.customer_id?String(r.customer_id):null,dueAt:mapDate(r.due_at),createdAt:mapDate(r.created_at),updatedAt:mapDate(r.updated_at)})),
    visits:visits.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),propertyId:r.property_id?String(r.property_id):null,title:String(r.title??""),address:String(r.address??""),targetLat:r.target_lat==null?null:Number(r.target_lat),targetLng:r.target_lng==null?null:Number(r.target_lng),radiusM:Number(r.radius_m??120),scheduledAt:mapDate(r.scheduled_at),status:String(r.status),arrivedAt:mapDate(r.arrived_at),leftAt:mapDate(r.left_at),notes:String(r.notes??"")})),
    contacts:contacts.map(r=>({id:String(r.id),staffId:String(r.staff_id),name:String(r.name??""),phone:String(r.phone??""),type:String(r.type??"customer"),notes:String(r.notes??""),propertyId:r.property_id?String(r.property_id):null,nextFollowUpAt:mapDate(r.next_follow_up_at)})),
    attendance:attendance.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),deviceId:String(r.device_id),workDate:String(r.work_date??""),startedAt:mapDate(r.started_at),endedAt:mapDate(r.ended_at)})),
    captures:captures.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),deviceId:String(r.device_id),propertyId:r.property_id?String(r.property_id):null,visitId:r.visit_id?String(r.visit_id):null,category:String(r.category??"general"),caption:String(r.caption??""),createdAt:mapDate(r.created_at),fileName:String(r.file_name??""),mimeType:String(r.mime_type??""),sizeBytes:Number(r.size_bytes??0),streamUrl:"/api/admin/mobile-management/staff-property-captures/"+encodeURIComponent(String(r.id))})),
    health:health.map(r=>({deviceId:String(r.device_id),staffId:String(r.staff_id),payload:r.payload,observedAt:mapDate(r.observed_at),receivedAt:mapDate(r.received_at)})),
    stats:{calls24h:Number(calls[0]?.[0]?.count)||0,recordings24h:Number(recordings[0]?.[0]?.count)||0},
  };
});
