import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { writeAdminAuditLog } from "@/lib/admin-audit";

type Snapshot = Record<string, unknown>;
const SNAPSHOT_KEYS = ["title","status","availabilityStatus","featured","price","deposit","rent","contactName","contactPhone","ownerName","ownerPhone","ownerInfo"] as const;
const FIELD_LABELS: Record<(typeof SNAPSHOT_KEYS)[number], string> = {
  title:"عنوان",status:"وضعیت انتشار",availabilityStatus:"وضعیت فایل",featured:"ویژه",price:"قیمت",deposit:"رهن",rent:"اجاره",
  contactName:"مشاور",contactPhone:"شماره مشاور",ownerName:"مالک",ownerPhone:"شماره مالک",ownerInfo:"یادداشت مالک",
};
async function requireAdmin(event:H3Event){
  if(!await verifyAdminSessionToken(getCookie(event,ADMIN_SESSION_COOKIE))) throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست. دوباره وارد پنل شوید."});
  assertSameOrigin(event);
}
function object(value:unknown):Snapshot{return value&&typeof value==="object"&&!Array.isArray(value)?value as Snapshot:{};}
function text(value:unknown,max:number){return String(value??"").trim().slice(0,max);}
function money(value:unknown){
  if(value==null||value==="")return null;
  const s=String(value).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٬،,\s]/g,"");
  return /^\d+$/.test(s)?s:null;
}
function bool(value:unknown){return value===true;}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","no-store");
  await requireAdmin(event);
  const body=(await readBody(event).catch(()=>({}))) as {action?:"list"|"restore";propertyId?:unknown;historyId?:unknown;limit?:unknown};
  if(dbSource==="unconfigured")return body.action==="restore"?{success:false}:{rows:[]};
  const sql=await getSql();

  if(body.action==="restore"){
    const propertyId=text(body.propertyId,160), historyId=Number(body.historyId);
    if(!propertyId||!Number.isInteger(historyId)||historyId<1)throw createError({statusCode:400,statusMessage:"نسخه انتخاب‌شده معتبر نیست."});
    const history=(await sql.query<Record<string,unknown>>("select id,property_id,action,after_state from property_change_history where id=$1 and property_id=$2 limit 1",[historyId,propertyId]))[0];
    if(!history||history.action!=="updated")throw createError({statusCode:404,statusMessage:"نسخه موردنظر پیدا نشد."});
    const snapshot=object(history.after_state);
    if(!Object.keys(snapshot).length)throw createError({statusCode:400,statusMessage:"این نسخه قابل بازگردانی نیست."});
    const current=(await sql.query<Record<string,unknown>>("select id,title,status,availability_status,featured,price,deposit,rent,contact_name,contact_phone,owner_name,owner_phone,owner_info from properties where id=$1 limit 1",[propertyId]))[0];
    if(!current)throw createError({statusCode:404,statusMessage:"فایل پیدا نشد."});

    const pick=(key:string,currentValue:unknown)=>Object.prototype.hasOwnProperty.call(snapshot,key)?snapshot[key]:currentValue;
    const title=text(pick("title",current.title),240);
    if(!title)throw createError({statusCode:400,statusMessage:"عنوان نسخه معتبر نیست."});
    const statuses=new Set(["draft","published","archived"]);
    const availability=new Set(["available","reserved","sold","rented","unavailable"]);
    const status=statuses.has(String(pick("status",current.status)))?String(pick("status",current.status)):String(current.status??"draft");
    const availabilityStatus=availability.has(String(pick("availabilityStatus",current.availability_status)))?String(pick("availabilityStatus",current.availability_status)):String(current.availability_status??"available");
    const nextPrice=money(pick("price",current.price)), nextDeposit=money(pick("deposit",current.deposit)), nextRent=money(pick("rent",current.rent));
    const nextContactName=text(pick("contactName",current.contact_name),80), nextContactPhone=text(pick("contactPhone",current.contact_phone),30);
    const nextOwnerName=text(pick("ownerName",current.owner_name),100), nextOwnerPhone=text(pick("ownerPhone",current.owner_phone),30), nextOwnerInfo=text(pick("ownerInfo",current.owner_info),2000);
    const nextFeatured=bool(pick("featured",current.featured));

    const updated=(await sql.query<Record<string,unknown>>(
      \`update properties set title=$1,status=$2,availability_status=$3,featured=$4,price=$5,deposit=$6,rent=$7,contact_name=$8,contact_phone=$9,owner_name=$10,owner_phone=$11,owner_info=$12,updated_at=current_timestamp where id=$13 and deleted_at is null returning id,title,slug,status,availability_status,featured,price,deposit,rent\`,
      [title,status,availabilityStatus,nextFeatured,nextPrice,nextDeposit,nextRent,nextContactName,nextContactPhone,nextOwnerName,nextOwnerPhone,nextOwnerInfo,propertyId],
    ))[0];
    if(!updated)throw createError({statusCode:409,statusMessage:"فایل در وضعیت قابل بازگردانی نیست."});

    const beforeState={
      title:current.title==null?null:String(current.title),status:current.status==null?null:String(current.status),
      availabilityStatus:current.availability_status==null?null:String(current.availability_status),featured:Boolean(current.featured),
      price:current.price==null?null:String(current.price),deposit:current.deposit==null?null:String(current.deposit),rent:current.rent==null?null:String(current.rent),
      contactName:current.contact_name==null?null:String(current.contact_name),contactPhone:current.contact_phone==null?null:String(current.contact_phone),
      ownerName:current.owner_name==null?null:String(current.owner_name),ownerPhone:current.owner_phone==null?null:String(current.owner_phone),ownerInfo:current.owner_info==null?null:String(current.owner_info),
    };
    const afterState={
      title:String(updated.title??""),status:String(updated.status??"draft"),availabilityStatus:String(updated.availability_status??"available"),featured:Boolean(updated.featured),
      price:updated.price==null?null:String(updated.price),deposit:updated.deposit==null?null:String(updated.deposit),rent:updated.rent==null?null:String(updated.rent),
      contactName:nextContactName,contactPhone:nextContactPhone,ownerName:nextOwnerName,ownerPhone:nextOwnerPhone,ownerInfo:nextOwnerInfo,restoredFromHistoryId:historyId,
    };
    await sql.query("insert into property_change_history(property_id,action,before_state,after_state) values($1,'updated',$2::jsonb,$3::jsonb)",[propertyId,JSON.stringify(beforeState),JSON.stringify(afterState)]);
    await writeAdminAuditLog({action:"property.version_restored",entityType:"property",entityId:propertyId,entityTitle:title,metadata:{historyId}}).catch(()=>{});
    return {success:true,propertyId,title,restoredFromHistoryId:historyId};
  }

  const limit=Math.min(60,Math.max(5,Number(body.limit)||40));
  const rows=await sql.query<Record<string,unknown>>(
    "select h.id,h.property_id,h.action,h.before_state,h.after_state,h.changed_at,p.title as property_title,p.slug from property_change_history h join properties p on p.id=h.property_id where h.action='updated' order by h.changed_at desc limit $1",[limit],
  );
  return {rows:rows.map((row)=>{
    const before=object(row.before_state),after=object(row.after_state);
    const changedFields=SNAPSHOT_KEYS.filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null));
    return {id:Number(row.id),propertyId:String(row.property_id),propertyTitle:String(row.property_title??"فایل"),slug:String(row.slug??""),changedAt:new Date(String(row.changed_at)).toISOString(),changedFields:changedFields.map(key=>FIELD_LABELS[key]),before,after};
  })};
});
