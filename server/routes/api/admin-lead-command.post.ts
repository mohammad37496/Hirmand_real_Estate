import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

type LeadStatus = "new" | "contacted" | "follow_up" | "visited" | "contract" | "closed" | "spam";
const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "follow_up", "visited", "contract"];

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست. دوباره وارد پنل شوید." });
  }
  assertSameOrigin(event);
}
function cleanText(value: unknown, max = 240) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function nullableDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw createError({ statusCode: 400, statusMessage: "تاریخ یا زمان نامعتبر است." });
  return date.toISOString();
}
function priorityFor(row: Record<string, unknown>) {
  const now = Date.now();
  const follow = row.follow_up_at ? new Date(String(row.follow_up_at)).getTime() : NaN;
  const visit = row.visit_preferred_at ? new Date(String(row.visit_preferred_at)).getTime() : NaN;
  if (Number.isFinite(follow) && follow <= now) return "urgent" as const;
  if (String(row.visit_status ?? "") === "requested") return "high" as const;
  if (Number.isFinite(visit) && visit <= now + 24 * 60 * 60 * 1000) return "high" as const;
  if (String(row.status) === "new" && !String(row.consultant ?? "").trim()) return "high" as const;
  return "normal" as const;
}
function nextActionFor(row: Record<string, unknown>) {
  if (String(row.status) === "new" && !String(row.consultant ?? "").trim()) return "تخصیص مشاور و تماس اولیه";
  if (String(row.status) === "new") return "تماس اولیه";
  if (String(row.follow_up_at ?? "") && new Date(String(row.follow_up_at)).getTime() <= Date.now()) return "پیگیری فوری";
  if (String(row.visit_status ?? "") === "requested") return "تأیید بازدید";
  if (String(row.status) === "visited") return "پیگیری نتیجه بازدید";
  if (String(row.status) === "contract") return "بررسی مدارک و قرارداد";
  if (String(row.status) === "follow_up") return "پیگیری برنامه‌ریزی‌شده";
  return "پیگیری مشتری";
}
async function loadData(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    select l.id,l.name,l.phone,l.status,l.consultant,l.deal,l.property_type,l.neighborhood,
           l.follow_up_at,l.last_contacted_at,l.visit_preferred_at,l.visit_requested_at,l.visit_status,
           l.property_id,l.created_at,l.updated_at,l.deal_stage,p.slug as property_slug,p.title as property_title
      from leads l
      left join properties p on p.id=l.property_id
     where l.status = any($1::text[])
     order by case
       when l.follow_up_at is not null and l.follow_up_at <= current_timestamp then 0
       when l.visit_status='requested' then 1
       when l.status='new' then 2
       else 3 end,
       l.follow_up_at asc nulls last,l.visit_preferred_at asc nulls last,l.created_at asc
     limit 320
  `, [ACTIVE_STATUSES]);
  const items = rows.map((row) => {
    const followUpAt=row.follow_up_at==null?null:new Date(String(row.follow_up_at)).toISOString();
    const visitPreferredAt=row.visit_preferred_at==null?null:new Date(String(row.visit_preferred_at)).toISOString();
    return {
      id:String(row.id),name:String(row.name??""),phone:String(row.phone??""),status:String(row.status) as LeadStatus,
      consultant:String(row.consultant??""),deal:String(row.deal??""),propertyType:String(row.property_type??""),
      neighborhood:String(row.neighborhood??""),followUpAt,
      lastContactedAt:row.last_contacted_at==null?null:new Date(String(row.last_contacted_at)).toISOString(),
      visitPreferredAt,visitRequestedAt:row.visit_requested_at==null?null:new Date(String(row.visit_requested_at)).toISOString(),
      visitStatus:String(row.visit_status??"none"),propertyId:row.property_id==null?null:String(row.property_id),
      propertySlug:row.property_slug==null?null:String(row.property_slug),propertyTitle:String(row.property_title??""),
      dealStage:String(row.deal_stage??"qualification"),createdAt:new Date(String(row.created_at)).toISOString(),
      priority:priorityFor(row),nextAction:nextActionFor(row),
    };
  });
  const overdue=items.filter(i=>i.followUpAt&&new Date(i.followUpAt).getTime()<=Date.now());
  const todayKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const dayKey=(value:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
  const today=items.filter(i=>i.followUpAt&&dayKey(i.followUpAt)===todayKey);
  const newLeads=items.filter(i=>i.status==="new");
  const visits=items.filter(i=>["requested","confirmed"].includes(i.visitStatus)&&i.visitPreferredAt&&new Date(i.visitPreferredAt).getTime()<=Date.now()+48*60*60*1000);
  const unassigned=items.filter(i=>!i.consultant.trim());
  return {generatedAt:new Date().toISOString(),stats:{overdue:overdue.length,today:today.length,newLeads:newLeads.length,upcomingVisits:visits.length,unassigned:unassigned.length},
    queues:{overdue:overdue.slice(0,12),today:today.slice(0,12),newLeads:newLeads.slice(0,12),upcomingVisits:visits.slice(0,12),unassigned:unassigned.slice(0,12)},items:items.slice(0,60)};
}
export default defineEventHandler(async (event) => {
  setResponseHeader(event,"cache-control","no-store"); await requireAdmin(event);
  const body=(await readBody(event).catch(()=>({}))) as {action?:string;id?:string;status?:LeadStatus;followUpAt?:string|null;consultant?:string;title?:string;description?:string;priority?:string};
  if(dbSource==="unconfigured") return {generatedAt:new Date().toISOString(),stats:{overdue:0,today:0,newLeads:0,upcomingVisits:0,unassigned:0},queues:{overdue:[],today:[],newLeads:[],upcomingVisits:[],unassigned:[]},items:[]};
  const sql=await getSql(); const id=cleanText(body.id,160);
  if(body.action==="status"){
    if(!id||!ACTIVE_STATUSES.concat(["closed","spam"]).includes(body.status as LeadStatus)) throw createError({statusCode:400,statusMessage:"وضعیت لید نامعتبر است."});
    const rows=await sql.query<{id:string;status:string}>("update leads set status=$2,updated_at=current_timestamp where id=$1 returning id,status",[id,body.status]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"لید پیدا نشد."});
    await sql.query(`insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'status',$2,$3,$4::jsonb)`,[id,"تغییر وضعیت از مرکز فرمان","وضعیت به "+body.status+" تغییر کرد.",JSON.stringify({status:body.status})]);
    return {success:true,status:rows[0].status};
  }
  if(body.action==="follow_up"){
    if(!id) throw createError({statusCode:400,statusMessage:"شناسه لید نامعتبر است."});
    const followUpAt=nullableDate(body.followUpAt);
    const rows=await sql.query<{id:string;follow_up_at:string|null}>("update leads set follow_up_at=$2,updated_at=current_timestamp where id=$1 returning id,follow_up_at",[id,followUpAt]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"لید پیدا نشد."});
    await sql.query(`insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'follow_up',$2,$3,$4::jsonb)`,[id,followUpAt?"پیگیری جدید ثبت شد":"پیگیری حذف شد",followUpAt?"زمان پیگیری از مرکز فرمان تنظیم شد.":"موعد پیگیری پاک شد.",JSON.stringify({followUpAt})]);
    return {success:true,followUpAt};
  }
  if(body.action==="assign"){
    if(!id) throw createError({statusCode:400,statusMessage:"شناسه لید نامعتبر است."});
    const consultant=cleanText(body.consultant,120); if(!consultant) throw createError({statusCode:400,statusMessage:"نام مشاور مشخص نیست."});
    const rows=await sql.query<{id:string;consultant:string}>("update leads set consultant=$2,updated_at=current_timestamp where id=$1 returning id,consultant",[id,consultant]);
    if(!rows[0]) throw createError({statusCode:404,statusMessage:"لید پیدا نشد."});
    await sql.query(`insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'status',$2,$3,$4::jsonb)`,[id,"تخصیص مشاور","لید از مرکز فرمان به "+consultant+" تخصیص داده شد.",JSON.stringify({consultant})]);
    return {success:true,consultant:rows[0].consultant};
  }
  if(body.action==="create_task"){
    if(!id) throw createError({statusCode:400,statusMessage:"شناسه لید نامعتبر است."});
    const title=cleanText(body.title,180); if(!title) throw createError({statusCode:400,statusMessage:"عنوان وظیفه مشخص نیست."});
    const description=cleanText(body.description,1200); const priority=["low","normal","high","urgent"].includes(body.priority??"")?body.priority:"normal";
    const task=await sql.query<{id:string}>(`insert into admin_tasks(id,title,description,status,priority,due_at,assignee,entity_type,entity_id)
      values($1,$2,$3,'open',$4,current_timestamp,'','lead',$5) returning id`,[crypto.randomUUID(),title,description,priority,id]);
    await sql.query(`insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'follow_up',$2,$3,$4::jsonb)`,[id,"وظیفه مدیریتی ساخته شد",title,JSON.stringify({taskId:task[0]?.id??""})]);
    return {success:true,taskId:task[0]?.id??null};
  }
  return loadData(sql);
});
