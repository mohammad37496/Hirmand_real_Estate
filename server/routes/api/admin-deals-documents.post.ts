import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { DB_MEDIA_PATH } from "@/lib/media";
import { deleteStoredMedia } from "@/lib/media-store.server";

const STAGES=["qualification","property_selection","viewing","negotiation","contract_preparation","contract_signed","won","lost"] as const;
const DOC_STATUS=["pending","verified","rejected"] as const;
async function requireAdmin(event:H3Event){
  if(!await verifyAdminSessionToken(getCookie(event,ADMIN_SESSION_COOKIE))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست. دوباره وارد پنل شوید."});
  assertSameOrigin(event);
}
function cleanText(value:unknown,max=300){return typeof value==="string"?value.trim().slice(0,max):"";}
function serializeDocument(row:Record<string,unknown>){
  return {id:String(row.id),leadId:row.lead_id==null?null:String(row.lead_id),propertyId:row.property_id==null?null:String(row.property_id),
    leadName:String(row.lead_name??""),propertyTitle:String(row.property_title??""),title:String(row.title??""),documentType:String(row.document_type??"other"),
    status:String(row.status??"pending"),fileUrl: row.media_id != null ? "/api/admin-document-media/" + String(row.media_id) : String(row.file_url ?? ""),fileName:String(row.file_name??""),mimeType:String(row.mime_type??"application/octet-stream"),
    sizeBytes:Number(row.size_bytes)||0,notes:String(row.notes??""),dueAt:row.due_at==null?null:new Date(String(row.due_at)).toISOString(),
    createdAt:new Date(String(row.created_at)).toISOString(),updatedAt:new Date(String(row.updated_at)).toISOString()};
}
async function summary(sql:Awaited<ReturnType<typeof getSql>>){
  const [stageRows,leadRows,docsRows]=await Promise.all([
    sql.query<Record<string,unknown>>("select coalesce(deal_stage,'qualification') as stage,count(*)::int as count from leads where status <> 'spam' group by coalesce(deal_stage,'qualification')"),
    sql.query<Record<string,unknown>>("select l.id,l.name,l.phone,l.status,l.deal,l.neighborhood,l.consultant,l.follow_up_at,l.deal_stage,l.property_id,p.slug as property_slug,p.title as property_title from leads l left join properties p on p.id=l.property_id where l.status in ('new','contacted','follow_up','visited','contract') order by case when l.follow_up_at is not null and l.follow_up_at <= current_timestamp then 0 else 1 end,l.updated_at desc limit 80"),
    sql.query<Record<string,unknown>>("select d.*,l.name as lead_name,p.title as property_title from admin_documents d left join leads l on l.id=d.lead_id left join properties p on p.id=d.property_id order by d.created_at desc limit 80"),
  ]);
  const stages=Object.fromEntries(STAGES.map(stage=>[stage,0])) as Record<string,number>;
  for(const row of stageRows) stages[String(row.stage)]=Number(row.count)||0;
  return {generatedAt:new Date().toISOString(),stages,
    leads:leadRows.map(row=>({id:String(row.id),name:String(row.name??""),phone:String(row.phone??""),status:String(row.status),deal:String(row.deal??""),
      neighborhood:String(row.neighborhood??""),consultant:String(row.consultant??""),dealStage:String(row.deal_stage??"qualification"),
      followUpAt:row.follow_up_at==null?null:new Date(String(row.follow_up_at)).toISOString(),propertyId:row.property_id==null?null:String(row.property_id),
      propertySlug:row.property_slug==null?null:String(row.property_slug),propertyTitle:String(row.property_title??"")})),
    documents:docsRows.map(serializeDocument)};
}
export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","no-store");await requireAdmin(event);
  const body=(await readBody(event).catch(()=>({}))) as {action?:string;leadId?:string;stage?:string;documentId?:string;status?:string};
  if(dbSource==="unconfigured") return {generatedAt:new Date().toISOString(),stages:{},leads:[],documents:[]};
  const sql=await getSql();
  if(body.action==="stage"){
    const leadId=cleanText(body.leadId,160);
    if(!leadId||!STAGES.includes(body.stage as typeof STAGES[number])) throw createError({statusCode:400,statusMessage:"مرحله معامله نامعتبر است."});
    const rows=await sql.query<{id:string;deal_stage:string}>("update leads set deal_stage=$2,updated_at=current_timestamp where id=$1 returning id,deal_stage",[leadId,body.stage]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"لید پیدا نشد."});
    await sql.query("insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'status',$2,$3,$4::jsonb)",[leadId,"مرحله معامله تغییر کرد","مرحله به "+body.stage+" تغییر کرد.",JSON.stringify({dealStage:body.stage})]);
    return {success:true,stage:rows[0].deal_stage};
  }
  if(body.action==="document_status"){
    const documentId=cleanText(body.documentId,160);
    if(!documentId||!DOC_STATUS.includes(body.status as typeof DOC_STATUS[number])) throw createError({statusCode:400,statusMessage:"وضعیت سند نامعتبر است."});
    const rows=await sql.query<{id:string;lead_id:string|null;status:string}>("update admin_documents set status=$2,updated_at=current_timestamp where id=$1 returning id,lead_id,status",[documentId,body.status]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"سند پیدا نشد."});
    if(rows[0].lead_id) await sql.query("insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'document',$2,$3,$4::jsonb)",[rows[0].lead_id,"وضعیت سند تغییر کرد","وضعیت سند به "+body.status+" تغییر کرد.",JSON.stringify({documentId})]);
    return {success:true,status:rows[0].status};
  }
  if(body.action==="delete_document"){
    const documentId=cleanText(body.documentId,160);if(!documentId) throw createError({statusCode:400,statusMessage:"شناسه سند نامعتبر است."});
    const rows=await sql.query<Record<string,unknown>>("delete from admin_documents where id=$1 returning id,media_id,lead_id",[documentId]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"سند پیدا نشد."});
    const mediaId=rows[0].media_id==null?"":String(rows[0].media_id);if(mediaId) await deleteStoredMedia(DB_MEDIA_PATH+mediaId);
    return {success:true};
  }
  return summary(sql);
});
