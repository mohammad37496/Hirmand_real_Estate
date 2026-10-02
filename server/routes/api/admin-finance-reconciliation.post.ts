import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
async function requireAdmin(event:H3Event){if(!await verifyAdminSessionToken(getCookie(event,ADMIN_SESSION_COOKIE)))throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست. دوباره وارد پنل شوید."});assertSameOrigin(event);}
function norm(v:string){return v.trim().toLocaleLowerCase().replace(/\s+/g," ");}
const ALLOWED=new Set([30,90,365]);
export default defineEventHandler(async(event)=>{
 setResponseHeader(event,"cache-control","no-store");await requireAdmin(event);
 const body=(await readBody(event).catch(()=>({}))) as {days?:unknown};const n=Number(body.days);const days=ALLOWED.has(n)?n:90;
 if(dbSource==="unconfigured")return {days,summary:{income:0,expense:0,balance:0,linked:0,unlinked:0,duplicates:0},rows:[],consultants:[]};
 const sql=await getSql();
 const tx=await sql.query<Record<string,unknown>>("select f.id,f.kind,f.title,f.amount,f.transaction_date,f.property_id,f.lead_id,f.consultant,f.category,f.note,p.title as property_title,l.name as lead_name from finance_transactions f left join properties p on p.id=f.property_id left join leads l on l.id=f.lead_id where f.transaction_date>=current_date-$1 * interval '1 day' order by f.transaction_date desc,f.created_at desc limit 1000",[days]);
 const rows=tx.map(r=>({id:Number(r.id),kind:String(r.kind),title:String(r.title??""),amount:Number(r.amount)||0,transactionDate:String(r.transaction_date),propertyId:r.property_id==null?null:String(r.property_id),leadId:r.lead_id==null?null:String(r.lead_id),consultant:String(r.consultant??""),category:String(r.category??""),propertyTitle:r.property_title==null?null:String(r.property_title),leadName:r.lead_name==null?null:String(r.lead_name)}));
 const seen=new Map<string,number>();for(const r of rows){const key=[r.kind,r.amount,r.transactionDate,norm(r.title)].join("|");seen.set(key,(seen.get(key)||0)+1);}
 const duplicateRows=rows.filter(r=>seen.get([r.kind,r.amount,r.transactionDate,norm(r.title)].join("|"))!>1);
 const duplicatesKeys=new Set(duplicateRows.map(r=>[r.kind,r.amount,r.transactionDate,norm(r.title)].join("|")));
 const anomalies=rows.filter(r=>!r.propertyId&&!r.leadId||duplicatesKeys.has([r.kind,r.amount,r.transactionDate,norm(r.title)].join("|")));
 const linked=rows.filter(r=>r.propertyId||r.leadId).length,unlinked=rows.filter(r=>!r.propertyId&&!r.leadId).length;
 const income=rows.filter(r=>r.kind==="income").reduce((s,r)=>s+r.amount,0),expense=rows.filter(r=>r.kind==="expense").reduce((s,r)=>s+r.amount,0);
 const consultantMap=new Map<string,{consultant:string;income:number;expense:number;count:number;linked:number}>();
 for(const r of rows){const key=r.consultant||"بدون مشاور";const cur=consultantMap.get(key)||{consultant:key,income:0,expense:0,count:0,linked:0};cur.count++;if(r.kind==="income")cur.income+=r.amount;else cur.expense+=r.amount;if(r.propertyId||r.leadId)cur.linked++;consultantMap.set(key,cur);}
 return {days,summary:{income,expense,balance:income-expense,linked,unlinked,duplicates:duplicatesKeys.size},rows:anomalies.slice(0,80),consultants:[...consultantMap.values()].sort((a,b)=>(b.income-b.expense)-(a.income-a.expense)).slice(0,30)};
});
