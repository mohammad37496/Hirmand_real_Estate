import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید." });
  }
  assertSameOrigin(event);
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function buildIssues(row: Record<string, unknown>) {
  const issues: Array<{code:string;label:string;severity:"high"|"medium";detail:string}> = [];
  const area=row.area_m2==null?null:Number(row.area_m2);
  const floor=row.floor==null?null:Number(row.floor);
  const totalFloors=row.total_floors==null?null:Number(row.total_floors);
  const transaction=text(row.transaction_type);
  const price=row.price==null?null:Number(row.price);
  const deposit=row.deposit==null?null:Number(row.deposit);
  const rent=row.rent==null?null:Number(row.rent);
  if(area==null||!Number.isFinite(area)||area<=0) issues.push({code:"area",label:"متراژ نامعتبر/خالی",severity:"high",detail:"متراژ باید یک عدد مثبت باشد."});
  if(floor!=null&&totalFloors!=null&&Number.isFinite(floor)&&Number.isFinite(totalFloors)&&floor>totalFloors) issues.push({code:"floor",label:"طبقه بیشتر از کل طبقات",severity:"high",detail:"طبقه ثبت‌شده از تعداد کل طبقات بیشتر است."});
  if(totalFloors!=null&&(!Number.isFinite(totalFloors)||totalFloors<=0)) issues.push({code:"total_floors",label:"تعداد طبقات نامعتبر",severity:"medium",detail:"تعداد طبقات کل باید بزرگ‌تر از صفر باشد."});
  if(["buy","sell"].includes(transaction)&&(price==null||!Number.isFinite(price)||price<=0)) issues.push({code:"sale_price",label:"قیمت فروش ناقص",severity:"high",detail:"فایل خرید/فروش قیمت معتبر ندارد."});
  if(["rent","mortgage"].includes(transaction)&&deposit==null&&rent==null) issues.push({code:"rent_price",label:"رهن/اجاره ناقص",severity:"high",detail:"فایل رهن/اجاره هیچ مبلغی ندارد."});
  if(["buy","sell"].includes(transaction)&&(deposit!=null||rent!=null)) issues.push({code:"money_mismatch",label:"ترکیب مالی ناسازگار",severity:"medium",detail:"برای فایل فروش، مبلغ رهن/اجاره نیز ثبت شده است."});
  if(!Array.isArray(row.images)||row.images.length===0) issues.push({code:"images",label:"بدون تصویر",severity:"medium",detail:"فایل تصویر ندارد."});
  if(!text(row.neighborhood)) issues.push({code:"neighborhood",label:"بدون محله",severity:"medium",detail:"محله برای فایل ثبت نشده است."});
  if(!text(row.contact_name)||!text(row.contact_phone)) issues.push({code:"contact",label:"اطلاعات تماس ناقص",severity:"high",detail:"نام یا شماره تماس مسئول فایل ناقص است."});
  const lat=row.latitude==null?null:Number(row.latitude), lon=row.longitude==null?null:Number(row.longitude);
  if((lat==null)!==(lon==null)) issues.push({code:"coordinates",label:"مختصات ناقص",severity:"medium",detail:"عرض و طول جغرافیایی باید هر دو وجود داشته باشند یا هر دو خالی باشند."});
  return issues;
}

export default defineEventHandler(async(event)=>{
  setResponseHeader(event,"cache-control","no-store"); await requireAdmin(event);
  const body=(await readBody(event).catch(()=>({}))) as {action?:string;propertyId?:string;title?:string;issue?:string;detail?:string};
  if(dbSource==="unconfigured") return {generatedAt:new Date().toISOString(),stats:{issues:0,high:0,duplicateGroups:0},issues:[],duplicates:[]};
  const sql=await getSql();

  if(body.action==="create_task"){
    const propertyId=text(body.propertyId); if(!propertyId) throw createError({statusCode:400,statusMessage:"شناسه فایل مشخص نیست."});
    const taskTitle=text(body.title)||"بررسی سلامت فایل";
    const detail=text(body.detail);
    const existing=await sql.query<{id:string}>("select id from admin_tasks where status='open' and entity_type='property' and entity_id=$1 and title=$2 limit 1",[propertyId,taskTitle]);
    if(!existing[0]) await sql.query(
      "insert into admin_tasks(id,title,description,status,priority,due_at,assignee,entity_type,entity_id) values($1,$2,$3,'open',$4,current_timestamp + interval '24 hours','',$5)",
      [crypto.randomUUID(),taskTitle,detail,String(body.issue??"").includes("high")?"urgent":"high",propertyId],
    );
    return {success:true,alreadyExists:Boolean(existing[0])};
  }

  const rows=await sql.query<Record<string,unknown>>(
    "select id,slug,title,status,transaction_type,property_type,neighborhood,area_m2,bedrooms,price,deposit,rent,floor,total_floors,built_year,images,contact_name,contact_phone,owner_phone,latitude,longitude,updated_at from properties where status <> 'archived' order by updated_at desc limit 500",
  );
  const issues:Array<{id:string;slug:string;title:string;neighborhood:string;status:string;severity:"high"|"medium";code:string;label:string;detail:string;updatedAt:string}>=[];
  for(const row of rows) for(const issue of buildIssues(row)) issues.push({
    id:String(row.id),slug:String(row.slug),title:String(row.title??""),neighborhood:text(row.neighborhood),status:String(row.status),
    severity:issue.severity,code:issue.code,label:issue.label,detail:issue.detail,updatedAt:new Date(String(row.updated_at)).toISOString(),
  });

  const duplicateQueries=[
    {kind:"owner",label:"مالک/شماره مالک مشترک",sql:"select trim(owner_phone) as duplicate_key,min(trim(owner_name)) as context,count(*)::int as file_count,jsonb_agg(jsonb_build_object('id',id,'slug',slug,'title',title,'neighborhood',neighborhood) order by updated_at desc) as files from properties where status <> 'archived' and coalesce(trim(owner_phone),'') <> '' group by trim(owner_phone) having count(*) > 1 order by file_count desc limit 18"},
    {kind:"contact",label:"شماره تماس/محله/متراژ مشترک",sql:"select trim(contact_phone) || '|' || lower(trim(neighborhood)) || '|' || coalesce(area_m2::text,'') as duplicate_key,min(trim(contact_name)) as context,count(*)::int as file_count,jsonb_agg(jsonb_build_object('id',id,'slug',slug,'title',title,'neighborhood',neighborhood) order by updated_at desc) as files from properties where status <> 'archived' and coalesce(trim(contact_phone),'') <> '' and area_m2 is not null group by trim(contact_phone),lower(trim(neighborhood)),area_m2 having count(*) > 1 order by file_count desc limit 18"},
    {kind:"title",label:"عنوان/محله مشترک",sql:"select lower(regexp_replace(trim(title), E'\\\\s+', '', 'g')) || '|' || lower(trim(neighborhood)) as duplicate_key,min(trim(title)) as context,count(*)::int as file_count,jsonb_agg(jsonb_build_object('id',id,'slug',slug,'title',title,'neighborhood',neighborhood) order by updated_at desc) as files from properties where status <> 'archived' and coalesce(trim(title),'') <> '' group by lower(regexp_replace(trim(title), E'\\\\s+', '', 'g')),lower(trim(neighborhood)) having count(*) > 1 order by file_count desc limit 18"},
  ] as const;
  const duplicateResults=await Promise.all(duplicateQueries.map(query=>sql.query<Record<string,unknown>>(query.sql).then(rows=>rows.map(row=>({
    kind:query.kind,label:query.label,key:String(row.duplicate_key??""),context:String(row.context??""),fileCount:Number(row.file_count)||0,
    files:Array.isArray(row.files)?row.files.map(file=>({id:String(file.id),slug:String(file.slug),title:String(file.title),neighborhood:String(file.neighborhood??"")})):[],
  })))));
  const duplicates=duplicateResults.flat().sort((a,b)=>b.fileCount-a.fileCount).slice(0,36);
  const rankedIssues=issues.sort((a,b)=>(a.severity==="high"?0:1)-(b.severity==="high"?0:1)||a.updatedAt.localeCompare(b.updatedAt)).slice(0,160);
  return {generatedAt:new Date().toISOString(),stats:{issues:issues.length,high:issues.filter(item=>item.severity==="high").length,duplicateGroups:duplicates.length},issues:rankedIssues,duplicates};
});
