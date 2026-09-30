import { createError, defineEventHandler, getCookie, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireAdmin(event:H3Event){
  if(!await verifyAdminSessionToken(getCookie(event,ADMIN_SESSION_COOKIE))){
    throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست. دوباره وارد پنل شوید."});
  }
  assertSameOrigin(event);
}

export default defineEventHandler(async(event)=>{
  await requireAdmin(event);
  setResponseHeader(event,"cache-control","no-store");
  if(dbSource==="unconfigured"){
    throw createError({statusCode:503,statusMessage:"پایگاه داده تنظیم نشده است."});
  }
  const sql=await getSql();
  const [properties,leads,activities,finance,consultants,attendance] = await Promise.all([
    sql.query("select * from properties"),
    sql.query("select * from leads"),
    sql.query("select * from lead_activities"),
    sql.query("select * from finance_transactions"),
    sql.query("select * from consultants"),
    sql.query("select * from staff_attendance"),
  ]);
  const payload={
    exportedAt:new Date().toISOString(),
    app:"Hirmand Real Estate",
    version:1,
    properties:properties,
    leads:leads,
    leadActivities:activities,
    financeTransactions:finance,
    consultants:consultants,
    attendance:attendance,
  };
  await sql.query(
    "insert into admin_backup_log(kind,table_counts) values($1,$2::jsonb)",
    ["json_export",JSON.stringify({
      properties:properties.length,leads:leads.length,leadActivities:activities.length,
      financeTransactions:finance.length,consultants:consultants.length,attendance:attendance.length
    })],
  ).catch(()=>{});
  setResponseHeader(event,"content-type","application/json; charset=utf-8");
  setResponseHeader(event,"content-disposition",'attachment; filename="hirmand-admin-backup.json"');
  return JSON.stringify(payload,null,2);
});
