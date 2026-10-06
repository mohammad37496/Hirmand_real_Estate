import { createError, defineEventHandler, getCookie, setResponseHeader, type H3Event } from "h3";
import { getSql, dbSource } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminSessionClaims, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { runStaffFollowUpAutomation } from "@/lib/staff-automation.server";

async function requireSecurityAdmin(event:H3Event){
  const token=getCookie(event,ADMIN_SESSION_COOKIE);
  if(!(await verifyAdminSessionToken(token))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست."});
  assertSameOrigin(event);
  const claims=await getAdminSessionClaims(token);
  if(!hasAdminPermission(normalizeAdminRole(claims?.role),"security.manage")) throw createError({statusCode:403,statusMessage:"مجوز مدیریت عملیات کارکنان فعال نیست."});
}

function dateOrNull(v:unknown){
  if(v==null||v==="")return null;
  const d=new Date(String(v));
  return Number.isFinite(d.getTime())?d.toISOString():null;
}
function s(v:unknown,max=240){return typeof v==="string"?v.trim().slice(0,max):"";}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","private, no-store");
  await requireSecurityAdmin(event);
  if(dbSource==="unconfigured") return {
    success:true,staff:[],devices:[],tasks:[],visits:[],contacts:[],interactions:[],attendance:[],captures:[],health:[],
    performance:[],daily:[],leads:[],properties:[],automation:{created:0,overdue:0},stats:{calls24h:0,recordings24h:0}
  };

  const sql=await getSql();
  const automation=await runStaffFollowUpAutomation(sql).catch(()=>({created:0,overdue:0}));

  const [staff,devices,tasks,visits,contacts,interactions,attendance,captures,health,performance,daily,leads,properties,calls,recordings]=await Promise.all([
    sql.query<Record<string,unknown>>("select id,name,role from consultants where is_active=true order by sort_order asc,name asc"),
    sql.query<Record<string,unknown>>("select d.id,d.device_id,d.staff_id,coalesce(c.name,'کارمند ناشناس') as staff_name,d.status,d.model,d.manufacturer,d.android_version,d.management_mode,d.last_seen_at,d.last_sync_at,d.lost_mode,d.lost_message from staff_mobile_devices d left join consultants c on c.id=d.staff_id order by c.sort_order asc nulls last,c.name asc,d.updated_at desc"),
    sql.query<Record<string,unknown>>("select t.id,t.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,t.title,t.description,t.status,t.priority,t.property_id,t.customer_id,t.due_at,t.created_at,t.updated_at,t.completed_at,t.automation_key from staff_mobile_tasks t left join consultants c on c.id=t.staff_id where t.status<>'cancelled' order by case when t.status in('open','in_progress') and t.due_at is not null and t.due_at<current_timestamp then 0 else 1 end,t.due_at asc nulls last,t.created_at desc limit 400"),
    sql.query<Record<string,unknown>>("select v.id,v.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,v.property_id,v.title,v.address,v.target_lat,v.target_lng,v.radius_m,v.scheduled_at,v.status,v.arrived_at,v.left_at,v.notes from staff_mobile_visits v left join consultants c on c.id=v.staff_id where v.status<>'cancelled' order by v.scheduled_at asc nulls last limit 300"),
    sql.query<Record<string,unknown>>(
      "select c.id,c.staff_id,coalesce(u.name,'کارمند ناشناس') staff_name,c.name,c.phone,c.type,c.notes,c.lead_id,c.property_id,c.next_follow_up_at,c.updated_at,"+
      "l.status as lead_status,l.deal as lead_deal,l.follow_up_at as lead_follow_up_at,l.neighborhood as lead_neighborhood,"+
      "coalesce(json_agg(distinct jsonb_build_object('id',p.id,'title',p.title,'slug',p.slug,'neighborhood',p.neighborhood,'areaM2',p.area_m2,'bedrooms',p.bedrooms,'transactionType',p.transaction_type,'propertyType',p.property_type)) filter(where p.id is not null),'[]'::json) as linked_properties "+
      "from staff_mobile_crm_contacts c left join consultants u on u.id=c.staff_id left join leads l on l.id=c.lead_id "+
      "left join staff_mobile_crm_contact_properties cp on cp.contact_id=c.id left join properties p on p.id=cp.property_id "+
      "group by c.id,u.name,l.status,l.deal,l.follow_up_at,l.neighborhood order by c.next_follow_up_at asc nulls last,c.updated_at desc limit 400"
    ),
    sql.query<Record<string,unknown>>("select id,contact_id,staff_id,kind,note,created_at from staff_mobile_crm_interactions order by created_at desc limit 600"),
    sql.query<Record<string,unknown>>("select a.id,a.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,a.device_id,a.work_date,a.started_at,a.ended_at from staff_mobile_attendance a left join consultants c on c.id=a.staff_id order by a.work_date desc,a.started_at desc nulls last limit 400"),
    sql.query<Record<string,unknown>>("select x.id,x.staff_id,coalesce(c.name,'کارمند ناشناس') staff_name,x.device_id,x.property_id,x.visit_id,x.category,x.caption,x.created_at,f.name file_name,f.mime_type,f.size_bytes from staff_mobile_property_captures x left join consultants c on c.id=x.staff_id join staff_mobile_files f on f.id=x.file_id order by x.created_at desc limit 240"),
    sql.query<Record<string,unknown>>("select h.device_id,h.staff_id,h.payload,h.observed_at,h.received_at from staff_mobile_health h order by h.observed_at desc limit 300"),
    sql.query<Record<string,unknown>>(
      "select c.id,c.name,c.role,"+
      "coalesce((select count(*) from staff_mobile_tasks t where t.staff_id=c.id and t.status='done' and t.completed_at>=current_timestamp-interval '30 days'),0)::int as tasks_done,"+
      "coalesce((select count(*) from staff_mobile_visits v where v.staff_id=c.id and v.status='completed' and v.left_at>=current_timestamp-interval '30 days'),0)::int as visits_done,"+
      "coalesce((select count(*) from staff_mobile_calls cl where cl.staff_id=c.id and cl.occurred_at>=current_timestamp-interval '30 days'),0)::int as calls_done,"+
      "coalesce((select count(*) from staff_mobile_attendance a where a.staff_id=c.id and a.started_at>=current_timestamp-interval '30 days'),0)::int as attendance_days,"+
      "coalesce((select count(*) from staff_mobile_crm_interactions i where i.staff_id=c.id and i.created_at>=current_timestamp-interval '30 days'),0)::int as interactions,"+
      "coalesce((select count(*) from staff_mobile_crm_contacts x where x.staff_id=c.id and x.next_follow_up_at is not null and x.next_follow_up_at<=current_timestamp),0)::int as overdue_followups "+
      "from consultants c where c.is_active=true order by c.sort_order asc,c.name asc"
    ),
    sql.query<Record<string,unknown>>(
      "select c.id,c.name,c.role,"+
      "coalesce((select count(*) from staff_mobile_tasks t where t.staff_id=c.id and t.due_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and t.due_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as tasks_today,"+
      "coalesce((select count(*) from staff_mobile_tasks t where t.staff_id=c.id and t.status='done' and t.completed_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and t.completed_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as tasks_done_today,"+
      "coalesce((select count(*) from staff_mobile_visits v where v.staff_id=c.id and v.scheduled_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and v.scheduled_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as visits_today,"+
      "coalesce((select count(*) from staff_mobile_visits v where v.staff_id=c.id and v.status='completed' and v.left_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and v.left_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as visits_done_today,"+
      "coalesce((select count(*) from staff_mobile_calls cl where cl.staff_id=c.id and cl.occurred_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and cl.occurred_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as calls_today,"+
      "coalesce((select count(*) from staff_mobile_crm_contacts x where x.staff_id=c.id and x.next_follow_up_at is not null and x.next_follow_up_at<=current_timestamp),0)::int as followups_due,"+
      "coalesce((select count(*) from staff_mobile_property_captures cp where cp.staff_id=c.id and cp.created_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and cp.created_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran')),0)::int as captures_today "+
      "from consultants c where c.is_active=true order by c.sort_order asc,c.name asc"
    ),
    sql.query<Record<string,unknown>>("select id,name,phone,status,source,consultant,deal,neighborhood,property_id,follow_up_at,created_at from leads where status<>'spam' order by case when follow_up_at is not null and follow_up_at<=current_timestamp then 0 else 1 end,follow_up_at asc nulls last,created_at desc limit 500"),
    sql.query<Record<string,unknown>>("select id,title,slug,status,transaction_type,property_type,neighborhood,area_m2,bedrooms,price,deposit,rent from properties order by updated_at desc limit 500"),
    sql.query<{count:number}[]>("select count(*)::int count from staff_mobile_calls where occurred_at>=current_timestamp-interval '1 day'"),
    sql.query<{count:number}[]>("select count(*)::int count from staff_mobile_call_recordings where created_at>=current_timestamp-interval '1 day'"),
  ]);

  const staffMap=new Map(staff.map(r=>[String(r.id),String(r.name??"")]));
  const mapDate=dateOrNull;

  const performanceOut=performance.map(r=>{
    const tasksDone=Number(r.tasks_done)||0,visitsDone=Number(r.visits_done)||0,callsDone=Number(r.calls_done)||0,attendanceDays=Number(r.attendance_days)||0,interactionsCount=Number(r.interactions)||0;
    return {
      staffId:String(r.id),staffName:String(r.name??""),role:String(r.role??""),
      tasksDone,visitsDone,callsDone,attendanceDays,interactions:interactionsCount,overdueFollowUps:Number(r.overdue_followups)||0,
      score:tasksDone*2+visitsDone*3+callsDone+attendanceDays*2+interactionsCount,
    };
  });

  return {
    success:true,generatedAt:new Date().toISOString(),
    staff:staff.map(r=>({id:String(r.id),name:String(r.name??""),role:String(r.role??"")})),
    devices:devices.map(r=>({id:String(r.id),deviceId:String(r.device_id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),status:String(r.status??""),model:String(r.model??""),manufacturer:String(r.manufacturer??""),androidVersion:String(r.android_version??""),managementMode:String(r.management_mode??""),lastSeenAt:mapDate(r.last_seen_at),lastSyncAt:mapDate(r.last_sync_at),lostMode:Boolean(r.lost_mode),lostMessage:String(r.lost_message??"")})),
    tasks:tasks.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),title:String(r.title??""),description:String(r.description??""),status:String(r.status),priority:String(r.priority),propertyId:r.property_id?String(r.property_id):null,customerId:r.customer_id?String(r.customer_id):null,dueAt:mapDate(r.due_at),createdAt:mapDate(r.created_at),updatedAt:mapDate(r.updated_at),completedAt:mapDate(r.completed_at),automation:Boolean(r.automation_key)})),
    visits:visits.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),propertyId:r.property_id?String(r.property_id):null,title:String(r.title??""),address:String(r.address??""),targetLat:r.target_lat==null?null:Number(r.target_lat),targetLng:r.target_lng==null?null:Number(r.target_lng),radiusM:Number(r.radius_m??120),scheduledAt:mapDate(r.scheduled_at),status:String(r.status),arrivedAt:mapDate(r.arrived_at),leftAt:mapDate(r.left_at),notes:String(r.notes??"")})),
    contacts:contacts.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),name:String(r.name??""),phone:String(r.phone??""),type:String(r.type??"customer"),notes:String(r.notes??""),leadId:r.lead_id?String(r.lead_id):null,leadStatus:r.lead_status?String(r.lead_status):null,leadDeal:r.lead_deal?String(r.lead_deal):null,leadNeighborhood:r.lead_neighborhood?String(r.lead_neighborhood):null,propertyId:r.property_id?String(r.property_id):null,nextFollowUpAt:mapDate(r.next_follow_up_at??r.lead_follow_up_at),linkedProperties:Array.isArray(r.linked_properties)?r.linked_properties:[]})),
    interactions:interactions.map(r=>({id:String(r.id),contactId:String(r.contact_id),staffId:String(r.staff_id),staffName:staffMap.get(String(r.staff_id))||"کارمند ناشناس",kind:String(r.kind??"note"),note:String(r.note??""),createdAt:mapDate(r.created_at)})),
    attendance:attendance.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),deviceId:String(r.device_id),workDate:String(r.work_date??""),startedAt:mapDate(r.started_at),endedAt:mapDate(r.ended_at)})),
    captures:captures.map(r=>({id:String(r.id),staffId:String(r.staff_id),staffName:String(r.staff_name??""),deviceId:String(r.device_id),propertyId:r.property_id?String(r.property_id):null,visitId:r.visit_id?String(r.visit_id):null,category:String(r.category??"general"),caption:String(r.caption??""),createdAt:mapDate(r.created_at),fileName:String(r.file_name??""),mimeType:String(r.mime_type??""),sizeBytes:Number(r.size_bytes??0),streamUrl:"/api/admin/mobile-management/staff-property-captures/"+encodeURIComponent(String(r.id))})),
    health:health.map(r=>({deviceId:String(r.device_id),staffId:String(r.staff_id),payload:r.payload,observedAt:mapDate(r.observed_at),receivedAt:mapDate(r.received_at)})),
    performance:performanceOut,
    daily:daily.map(r=>({staffId:String(r.id),staffName:String(r.name??""),role:String(r.role??""),tasksToday:Number(r.tasks_today)||0,tasksDoneToday:Number(r.tasks_done_today)||0,visitsToday:Number(r.visits_today)||0,visitsDoneToday:Number(r.visits_done_today)||0,callsToday:Number(r.calls_today)||0,followUpsDue:Number(r.followups_due)||0,capturesToday:Number(r.captures_today)||0})),
    leads:leads.map(r=>({id:String(r.id),name:String(r.name??""),phone:String(r.phone??""),status:String(r.status??"new"),source:String(r.source??""),consultant:String(r.consultant??""),deal:String(r.deal??""),neighborhood:String(r.neighborhood??""),propertyId:r.property_id?String(r.property_id):null,followUpAt:mapDate(r.follow_up_at),createdAt:mapDate(r.created_at)})),
    properties:properties.map(r=>({id:String(r.id),title:String(r.title??""),slug:String(r.slug??""),status:String(r.status??""),transactionType:String(r.transaction_type??""),propertyType:String(r.property_type??""),neighborhood:String(r.neighborhood??""),areaM2:r.area_m2==null?null:Number(r.area_m2),bedrooms:r.bedrooms==null?null:Number(r.bedrooms),price:r.price==null?null:Number(r.price),deposit:r.deposit==null?null:Number(r.deposit),rent:r.rent==null?null:Number(r.rent)})),
    automation:{created:Number(automation.created)||0,overdue:Number(automation.overdue)||0},
    stats:{calls24h:Number(calls[0]?.[0]?.count)||0,recordings24h:Number(recordings[0]?.[0]?.count)||0},
  };
});