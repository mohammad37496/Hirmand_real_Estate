import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminSessionClaims, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit-log.server";
import { runStaffFollowUpAutomation } from "@/lib/staff-automation.server";

async function requireSecurityAdmin(event:H3Event){
  const token=getCookie(event,ADMIN_SESSION_COOKIE);
  if(!(await verifyAdminSessionToken(token))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست."});
  assertSameOrigin(event);
  const claims=await getAdminSessionClaims(token);
  if(!hasAdminPermission(normalizeAdminRole(claims?.role),"security.manage")) throw createError({statusCode:403,statusMessage:"مجوز مدیریت عملیات کارکنان فعال نیست."});
  return claims;
}
const s=(v:unknown,max=240)=>typeof v==="string"?v.trim().slice(0,max):"";
function iso(v:unknown){
  if(v==null||v==="")return null;
  const d=new Date(String(v));
  if(!Number.isFinite(d.getTime()))throw createError({statusCode:400,statusMessage:"زمان نامعتبر است."});
  return d.toISOString();
}
function num(v:unknown,min=-100000,max=100000){
  if(v==null||v==="")return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

const CRM_TYPES=new Set(["owner","buyer","tenant","builder","partner","customer","other"]);
const CRM_RELATIONS=new Set(["interested","viewing","owner","buyer","tenant","seller","related"]);

async function validateProperties(sql:Awaited<ReturnType<typeof getSql>>, ids:string[]){
  const unique=[...new Set(ids.map(v=>s(v,160)).filter(Boolean))].slice(0,30);
  if(!unique.length)return [];
  const rows=await sql.query<{id:string}>("select id from properties where id=any($1::text[])",[unique]);
  const valid=new Set(rows.map(r=>String(r.id)));
  if(valid.size!==unique.length)throw createError({statusCode:404,statusMessage:"یکی از فایل‌های انتخاب‌شده پیدا نشد."});
  return unique;
}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","private, no-store");
  const claims=await requireSecurityAdmin(event);
  if(dbSource==="unconfigured")return{success:true,skipped:true};
  const sql=await getSql();
  const body=(await readBody(event).catch(()=>({}))) as Record<string,unknown>;
  const action=s(body.action,60);
  const actor=claims?.accountId?String(claims.accountId):normalizeAdminRole(claims?.role);

  if(action==="create_task"){
    const staffId=s(body.staffId,80),title=s(body.title,180);
    if(!staffId||!title)throw createError({statusCode:400,statusMessage:"کارمند و عنوان وظیفه الزامی است."});
    const staff=await sql.query("select id,name from consultants where id=$1 and is_active=true",[staffId]);
    if(!staff[0])throw createError({statusCode:404,statusMessage:"کارمند فعال پیدا نشد."});
    const status=new Set(["open","in_progress","done"]).has(s(body.status,30))?s(body.status,30):"open";
    const priority=new Set(["low","normal","high","urgent"]).has(s(body.priority,30))?s(body.priority,30):"normal";
    const id=randomUUID();
    await sql.query("insert into staff_mobile_tasks(id,staff_id,device_id,title,description,status,priority,property_id,customer_id,due_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[id,staffId,s(body.deviceId,100)||null,title,s(body.description,1200),status,priority,s(body.propertyId,160)||null,s(body.customerId,160)||null,iso(body.dueAt)]);
    await writeAdminAuditLog({action:"staff_mobile_task.created",entityType:"staff_mobile_task",entityId:id,entityTitle:title,actor,metadata:{staffId,priority,propertyId:s(body.propertyId,160)||null,customerId:s(body.customerId,160)||null}});
    return{success:true,id};
  }

  if(action==="update_task"){
    const id=s(body.id,120),status=s(body.status,30);
    if(!id||!new Set(["open","in_progress","done","cancelled"]).has(status))throw createError({statusCode:400,statusMessage:"وظیفه نامعتبر است."});
    await sql.query("update staff_mobile_tasks set status=$1,updated_at=current_timestamp,completed_at=case when $1='done' then current_timestamp else completed_at end where id=$2",[status,id]);
    return{success:true};
  }

  if(action==="create_visit"){
    const staffId=s(body.staffId,80),title=s(body.title,180);
    if(!staffId||!title)throw createError({statusCode:400,statusMessage:"کارمند و عنوان بازدید الزامی است."});
    const staff=await sql.query("select id,name from consultants where id=$1 and is_active=true",[staffId]);
    if(!staff[0])throw createError({statusCode:404,statusMessage:"کارمند فعال پیدا نشد."});
    const lat=num(body.targetLat,-90,90),lng=num(body.targetLng,-180,180);
    const radius=Math.max(40,Math.min(500,Number(body.radiusM)||120));
    const id=randomUUID();
    await sql.query("insert into staff_mobile_visits(id,staff_id,device_id,property_id,title,address,target_lat,target_lng,radius_m,scheduled_at,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[id,staffId,s(body.deviceId,100)||null,s(body.propertyId,160)||null,title,s(body.address,500),lat,lng,radius,iso(body.scheduledAt),s(body.notes,1200)]);
    await writeAdminAuditLog({action:"staff_mobile_visit.created",entityType:"staff_mobile_visit",entityId:id,entityTitle:title,actor,metadata:{staffId,propertyId:s(body.propertyId,160)||null}});
    return{success:true,id};
  }

  if(action==="create_contact"){
    const staffId=s(body.staffId,80),name=s(body.name,180),leadId=s(body.leadId,120)||null;
    if(!staffId||!name)throw createError({statusCode:400,statusMessage:"کارمند و نام مخاطب الزامی است."});
    const staff=await sql.query("select id from consultants where id=$1 and is_active=true",[staffId]);
    if(!staff[0])throw createError({statusCode:404,statusMessage:"کارمند فعال پیدا نشد."});
    if(leadId){
      const lead=await sql.query("select id,property_id from leads where id=$1 limit 1",[leadId]);
      if(!lead[0])throw createError({statusCode:404,statusMessage:"لید انتخاب‌شده پیدا نشد."});
    }
    const rawIds=[s(body.propertyId,160),...(Array.isArray(body.propertyIds)?body.propertyIds.map(v=>s(v,160)):[])];
    const propertyIds=await validateProperties(sql,rawIds);
    const type=CRM_TYPES.has(s(body.type,30))?s(body.type,30):"customer";
    const id=randomUUID();
    await sql.query("insert into staff_mobile_crm_contacts(id,staff_id,name,phone,type,notes,lead_id,property_id,next_follow_up_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",[id,staffId,name,s(body.phone,80),type,s(body.notes,1200),leadId,propertyIds[0]||null,iso(body.nextFollowUpAt)]);
    for(const propertyId of propertyIds){
      await sql.query("insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,$3) on conflict(contact_id,property_id) do update set relation_type=excluded.relation_type,updated_at=current_timestamp",[id,propertyId,CRM_RELATIONS.has(s(body.relationType,30))?s(body.relationType,30):"interested"]);
    }
    await writeAdminAuditLog({action:"staff_mobile_crm_contact.created",entityType:"staff_mobile_crm_contact",entityId:id,entityTitle:name,actor,metadata:{staffId,type,leadId,propertyIds}});
    return{success:true,id};
  }

  if(action==="link_contact"){
    const contactId=s(body.contactId,120);
    if(!contactId)throw createError({statusCode:400,statusMessage:"مخاطب مشخص نیست."});
    const contact=await sql.query("select id from staff_mobile_crm_contacts where id=$1 limit 1",[contactId]);
    if(!contact[0])throw createError({statusCode:404,statusMessage:"مخاطب پیدا نشد."});
    const leadId=s(body.leadId,120)||null;
    if(leadId){
      const lead=await sql.query("select id,property_id from leads where id=$1 limit 1",[leadId]);
      if(!lead[0])throw createError({statusCode:404,statusMessage:"لید انتخاب‌شده پیدا نشد."});
      await sql.query("update staff_mobile_crm_contacts set lead_id=$1,property_id=coalesce(property_id,$2),updated_at=current_timestamp where id=$3",[leadId,lead[0].property_id?String(lead[0].property_id):null,contactId]);
      if(lead[0].property_id)await sql.query("insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,'interested') on conflict(contact_id,property_id) do update set updated_at=current_timestamp",[contactId,String(lead[0].property_id)]);
    }
    const propertyIds=await validateProperties(sql,Array.isArray(body.propertyIds)?body.propertyIds:[]);
    if(Boolean(body.replaceProperties))await sql.query("delete from staff_mobile_crm_contact_properties where contact_id=$1",[contactId]);
    for(const propertyId of propertyIds){
      await sql.query("insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,$3) on conflict(contact_id,property_id) do update set relation_type=excluded.relation_type,updated_at=current_timestamp",[contactId,propertyId,CRM_RELATIONS.has(s(body.relationType,30))?s(body.relationType,30):"interested"]);
    }
    await writeAdminAuditLog({action:"staff_mobile_crm_contact.linked",entityType:"staff_mobile_crm_contact",entityId:contactId,entityTitle:"CRM link",actor,metadata:{leadId,propertyIds}});
    return{success:true};
  }

  if(action==="generate_followups"){
    const result=await runStaffFollowUpAutomation(sql,{limitPerStaff:50});
    await writeAdminAuditLog({action:"staff_mobile_automation.followups",entityType:"staff_mobile_automation",entityId:"followups",entityTitle:"Follow-up automation",actor,metadata:result});
    return{success:true,...result};
  }

  if(action==="generate_daily_reports"){
    const rows=await sql.query<Record<string,unknown>>(
      "select c.id,"+
      "(select count(*) from staff_mobile_tasks t where t.staff_id=c.id and t.status='done' and t.completed_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and t.completed_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran'))::int tasks_done,"+
      "(select count(*) from staff_mobile_visits v where v.staff_id=c.id and v.status='completed' and v.left_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and v.left_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran'))::int visits_done,"+
      "(select count(*) from staff_mobile_calls cl where cl.staff_id=c.id and cl.occurred_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and cl.occurred_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran'))::int calls,"+
      "(select count(*) from staff_mobile_crm_interactions i where i.staff_id=c.id and i.created_at>=((current_timestamp at time zone 'Asia/Tehran')::date at time zone 'Asia/Tehran') and i.created_at<(((current_timestamp at time zone 'Asia/Tehran')::date+1) at time zone 'Asia/Tehran'))::int interactions "+
      "from consultants c where c.is_active=true"
    );
    for(const row of rows){
      const summary={
        tasksDone:Number(row.tasks_done)||0,visitsDone:Number(row.visits_done)||0,calls:Number(row.calls)||0,interactions:Number(row.interactions)||0,
        generatedBy:"admin",generatedAt:new Date().toISOString()
      };
      await sql.query(
        "insert into staff_mobile_daily_reports(id,staff_id,report_date,summary) values($1,$2,(current_timestamp at time zone 'Asia/Tehran')::date,$3::jsonb) "+
        "on conflict(staff_id,report_date) do update set summary=excluded.summary,generated_at=current_timestamp,updated_at=current_timestamp",
        [randomUUID(),String(row.id),JSON.stringify(summary)]
      );
    }
    await writeAdminAuditLog({action:"staff_mobile_reports.daily_generated",entityType:"staff_mobile_daily_report",entityId:"today",entityTitle:"گزارش روزانه کارکنان",actor,metadata:{count:rows.length}});
    return{success:true,count:rows.length};
  }

  if(action==="device_lost"||action==="device_lost_clear"){
    const deviceId=s(body.deviceId,100);
    if(!deviceId)throw createError({statusCode:400,statusMessage:"دستگاه نامعتبر است."});
    await sql.query("update staff_mobile_devices set lost_mode=$1,lost_message=$2,updated_at=current_timestamp where device_id=$3",[action==="device_lost",action==="device_lost"?s(body.message,500):"",deviceId]);
    await writeAdminAuditLog({action:"staff_mobile_device."+action,entityType:"staff_mobile_device",entityId:deviceId,entityTitle:"Staff device",actor,metadata:{message:s(body.message,500)}});
    return{success:true};
  }

  if(action==="device_status"){
    const deviceId=s(body.deviceId,100),status=s(body.status,30);
    if(!deviceId||!new Set(["active","pending","revoked"]).has(status))throw createError({statusCode:400,statusMessage:"وضعیت دستگاه نامعتبر است."});
    await sql.query("update staff_mobile_devices set status=$1,updated_at=current_timestamp where device_id=$2",[status,deviceId]);
    return{success:true};
  }

  throw createError({statusCode:400,statusMessage:"عملیات مدیریت کارکنان شناخته نشد."});
});