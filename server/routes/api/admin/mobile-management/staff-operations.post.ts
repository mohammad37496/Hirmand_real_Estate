import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminSessionClaims, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit-log.server";

async function requireSecurityAdmin(event:H3Event){
  const token=getCookie(event,ADMIN_SESSION_COOKIE);
  if(!(await verifyAdminSessionToken(token))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست."});
  assertSameOrigin(event);
  const claims=await getAdminSessionClaims(token);
  if(!hasAdminPermission(normalizeAdminRole(claims?.role),"security.manage")) throw createError({statusCode:403,statusMessage:"مجوز مدیریت عملیات کارکنان فعال نیست."});
  return claims;
}
const s=(v:unknown,max=240)=>typeof v==="string"?v.trim().slice(0,max):"";
function iso(v:unknown){if(v==null||v==="")return null;const d=new Date(String(v));if(!Number.isFinite(d.getTime()))throw createError({statusCode:400,statusMessage:"زمان نامعتبر است."});return d.toISOString()}
function num(v:unknown,min=-100000,max=100000){if(v==null||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","private, no-store");
  const claims=await requireSecurityAdmin(event);
  if(dbSource==="unconfigured") return {success:true,skipped:true};
  const sql=await getSql();
  const body=(await readBody(event).catch(()=>({}))) as Record<string,unknown>;
  const action=s(body.action,50);
  const actor=claims?.accountId?String(claims.accountId):normalizeAdminRole(claims?.role);

  if(action==="create_task"){
    const staffId=s(body.staffId,80), title=s(body.title,180);
    if(!staffId||!title) throw createError({statusCode:400,statusMessage:"کارمند و عنوان وظیفه الزامی است."});
    const staff=await sql.query("select id,name from consultants where id=$1 and is_active=true",[staffId]);
    if(!staff[0]) throw createError({statusCode:404,statusMessage:"کارمند فعال پیدا نشد."});
    const status=new Set(["open","in_progress","done"]).has(s(body.status,30))?s(body.status,30):"open";
    const priority=new Set(["low","normal","high","urgent"]).has(s(body.priority,30))?s(body.priority,30):"normal";
    const id=randomUUID();
    await sql.query("insert into staff_mobile_tasks(id,staff_id,device_id,title,description,status,priority,property_id,customer_id,due_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[id,staffId,s(body.deviceId,100)||null,title,s(body.description,1200),status,priority,s(body.propertyId,160)||null,s(body.customerId,160)||null,iso(body.dueAt)]);
    await writeAdminAuditLog({action:"staff_mobile_task.created",entityType:"staff_mobile_task",entityId:id,entityTitle:title,actor,metadata:{staffId,priority}});
    return {success:true,id};
  }

  if(action==="update_task"){
    const id=s(body.id,120),status=s(body.status,30);
    if(!id||!new Set(["open","in_progress","done","cancelled"]).has(status)) throw createError({statusCode:400,statusMessage:"وظیفه نامعتبر است."});
    await sql.query("update staff_mobile_tasks set status=$1,updated_at=current_timestamp,completed_at=case when $1='done' then current_timestamp else completed_at end where id=$2",[status,id]);
    return {success:true};
  }

  if(action==="create_visit"){
    const staffId=s(body.staffId,80),title=s(body.title,180);
    if(!staffId||!title) throw createError({statusCode:400,statusMessage:"کارمند و عنوان بازدید الزامی است."});
    const staff=await sql.query("select id,name from consultants where id=$1 and is_active=true",[staffId]);
    if(!staff[0]) throw createError({statusCode:404,statusMessage:"کارمند فعال پیدا نشد."});
    const lat=num(body.targetLat,-90,90),lng=num(body.targetLng,-180,180);
    const radius=Math.max(40,Math.min(500,Number(body.radiusM)||120));
    const id=randomUUID();
    await sql.query("insert into staff_mobile_visits(id,staff_id,device_id,property_id,title,address,target_lat,target_lng,radius_m,scheduled_at,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[id,staffId,s(body.deviceId,100)||null,s(body.propertyId,160)||null,title,s(body.address,500),lat,lng,radius,iso(body.scheduledAt),s(body.notes,1200)]);
    await writeAdminAuditLog({action:"staff_mobile_visit.created",entityType:"staff_mobile_visit",entityId:id,entityTitle:title,actor,metadata:{staffId,propertyId:s(body.propertyId,160)||null}});
    return {success:true,id};
  }

  if(action==="create_contact"){
    const staffId=s(body.staffId,80),name=s(body.name,180);
    if(!staffId||!name) throw createError({statusCode:400,statusMessage:"کارمند و نام مخاطب الزامی است."});
    const id=randomUUID();
    const type=new Set(["owner","buyer","tenant","builder","partner","customer","other"]).has(s(body.type,30))?s(body.type,30):"customer";
    await sql.query("insert into staff_mobile_crm_contacts(id,staff_id,name,phone,type,notes,property_id,next_follow_up_at) values($1,$2,$3,$4,$5,$6,$7,$8)",[id,staffId,name,s(body.phone,80),type,s(body.notes,1200),s(body.propertyId,160)||null,iso(body.nextFollowUpAt)]);
    await writeAdminAuditLog({action:"staff_mobile_crm_contact.created",entityType:"staff_mobile_crm_contact",entityId:id,entityTitle:name,actor,metadata:{staffId,type}});
    return {success:true,id};
  }

  if(action==="device_lost"||action==="device_lost_clear"){
    const deviceId=s(body.deviceId,100);
    if(!deviceId) throw createError({statusCode:400,statusMessage:"دستگاه نامعتبر است."});
    await sql.query("update staff_mobile_devices set lost_mode=$1,lost_message=$2,updated_at=current_timestamp where device_id=$3",[action==="device_lost",action==="device_lost"?s(body.message,500):"",deviceId]);
    await writeAdminAuditLog({action:"staff_mobile_device."+action,entityType:"staff_mobile_device",entityId:deviceId,entityTitle:"Staff device",actor,metadata:{message:s(body.message,500)}});
    return {success:true};
  }

  if(action==="device_status"){
    const deviceId=s(body.deviceId,100),status=s(body.status,30);
    if(!deviceId||!new Set(["active","pending","revoked"]).has(status)) throw createError({statusCode:400,statusMessage:"وضعیت دستگاه نامعتبر است."});
    await sql.query("update staff_mobile_devices set status=$1,updated_at=current_timestamp where device_id=$2",[status,deviceId]);
    return {success:true};
  }

  throw createError({statusCode:400,statusMessage:"عملیات مدیریت کارکنان شناخته نشد."});
});
