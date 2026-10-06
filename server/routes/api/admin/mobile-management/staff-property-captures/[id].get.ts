import { createError, defineEventHandler, getCookie, getRouterParam, setResponseHeader, type H3Event } from "h3";
import { getSql, dbSource } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken, getAdminSessionClaims } from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit-log.server";

export default defineEventHandler(async(event)=>{
  const token=getCookie(event,ADMIN_SESSION_COOKIE);
  if(!(await verifyAdminSessionToken(token))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست."});
  assertSameOrigin(event);
  const claims=await getAdminSessionClaims(token);
  if(!hasAdminPermission(normalizeAdminRole(claims?.role),"security.manage")) throw createError({statusCode:403,statusMessage:"مجوز مشاهده تصاویر کارکنان فعال نیست."});
  if(dbSource==="unconfigured") throw createError({statusCode:503,statusMessage:"پایگاه داده آماده نیست."});
  const id=String(getRouterParam(event,"id")??"");
  const sql=await getSql();
  const rows=await sql.query<{name:string;mime_type:string;content:Buffer;staff_id:string}[]>(
    "select f.name,f.mime_type,f.content,c.staff_id from staff_mobile_property_captures c join staff_mobile_files f on f.id=c.file_id where c.id=$1 limit 1",[id]
  );
  if(!rows[0]) throw createError({statusCode:404,statusMessage:"تصویر پیدا نشد."});
  setResponseHeader(event,"cache-control","private, no-store");
  setResponseHeader(event,"content-type",rows[0].mime_type);
  const download=String(event.node.req.url??"").includes("download=1");
  if(download) setResponseHeader(event,"content-disposition",\`attachment; filename="\${rows[0].name}"\`);
  else setResponseHeader(event,"content-disposition","inline");
  await writeAdminAuditLog({action:download?"staff_mobile_capture.downloaded":"staff_mobile_capture.viewed",entityType:"staff_mobile_property_capture",entityId:id,actor:claims?.accountId?String(claims.accountId):normalizeAdminRole(claims?.role),metadata:{staffId:rows[0].staff_id}});
  return rows[0].content;
});
