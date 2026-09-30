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
  setResponseHeader(event,"cache-control","no-store");
  await requireAdmin(event);
  if(dbSource==="unconfigured") return {dueLeads:[],dueCount:0,next7Count:0,staleProperties:0,finance:{income:0,expense:0,balance:0}};
  const sql=await getSql();
  const [due,next7,stale,finance] = await Promise.all([
    sql.query<Record<string,unknown>>(
      `select id,name,phone,deal,neighborhood,status,follow_up_at
       from leads
       where status in ('new','contacted','follow_up','visited','contract')
         and follow_up_at is not null and follow_up_at <= current_timestamp
       order by follow_up_at asc limit 12`),
    sql.query<{count:number}>(
      `select count(*)::int as count from leads
       where status in ('new','contacted','follow_up','visited','contract')
         and follow_up_at > current_timestamp and follow_up_at <= current_timestamp + interval '7 days'`),
    sql.query<{count:number}>(
      `select count(*)::int as count from properties
       where status='published' and updated_at < current_timestamp - interval '30 days'`),
    sql.query<{income:number;expense:number}>(
      "select coalesce(sum(amount) filter(where kind='income'),0)::numeric as income, coalesce(sum(amount) filter(where kind='expense'),0)::numeric as expense from finance_transactions"),
  ]);
  const income=Number(finance[0]?.income)||0,expense=Number(finance[0]?.expense)||0;
  return {
    dueCount:due.length,
    dueLeads:due.map(r=>({
      id:String(r.id),name:String(r.name),phone:String(r.phone),deal:String(r.deal),
      neighborhood:String(r.neighborhood??""),status:String(r.status),
      followUpAt:r.follow_up_at==null?null:new Date(String(r.follow_up_at)).toISOString()
    })),
    next7Count:Number(next7[0]?.count)||0,
    staleProperties:Number(stale[0]?.count)||0,
    finance:{income,expense,balance:income-expense}
  };
});
