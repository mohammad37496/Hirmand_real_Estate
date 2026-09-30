import { createError, defineEventHandler } from "h3";
import { handleChunkedUpload } from "@/lib/chunked-upload.server";
import { DB_MEDIA_PATH } from "@/lib/media";
import { getSql } from "@/lib/db";

const MAX_BYTES=12*1024*1024;
const ALLOWED=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
function mimeFromFilename(filename:string){const ext=filename.split(".").pop()?.toLowerCase()??"";if(ext==="pdf")return"application/pdf";if(ext==="jpg"||ext==="jpeg")return"image/jpeg";if(ext==="png")return"image/png";if(ext==="webp")return"image/webp";return"";}

export default defineEventHandler((event)=>handleChunkedUpload(event,{
  kind:"admin-document",pathPrefix:"admin/documents",maxBytes:MAX_BYTES,databaseOnly:true,textFields:[
    {column:"title",label:"عنوان سند",required:true,maxLength:160},{column:"artist",label:"اطلاعات سند",required:true,maxLength:1800},
  ],
  resolveContentType:({filename,declared})=>ALLOWED.has(declared)?declared:ALLOWED.has(mimeFromFilename(filename))?mimeFromFilename(filename):null,
  unsupportedTypeMessage:"فقط PDF، JPG، PNG و WebP برای اسناد پذیرفته می‌شود.",
  sizeLimitMessage:(limitMb)=>"حجم سند بیش از "+limitMb+" مگابایت است.",
  finish:async({stored,session,text,totalBytes})=>{
    if(stored.storage!=="database"||!stored.id) throw createError({statusCode:503,statusMessage:"ذخیره امن سند در پایگاه داده در دسترس نیست."});
    let metadata:{leadId?:string;propertyId?:string;documentType?:string;notes?:string;dueAt?:string|null};
    try{metadata=JSON.parse(text.artist) as typeof metadata;}catch{throw createError({statusCode:400,statusMessage:"اطلاعات سند نامعتبر است."});}
    const leadId=typeof metadata.leadId==="string"?metadata.leadId.trim().slice(0,160):"";
    const propertyId=typeof metadata.propertyId==="string"?metadata.propertyId.trim().slice(0,160):"";
    if(!leadId&&!propertyId) throw createError({statusCode:400,statusMessage:"سند باید به یک لید یا فایل متصل باشد."});
    const documentType=["identity","ownership","property","bank","contract","receipt","other"].includes(String(metadata.documentType))?String(metadata.documentType):"other";
    const notes=typeof metadata.notes==="string"?metadata.notes.trim().slice(0,1200):"";
    let dueAt:string|null=null;if(metadata.dueAt){const date=new Date(metadata.dueAt);if(!Number.isFinite(date.getTime()))throw createError({statusCode:400,statusMessage:"موعد سند نامعتبر است."});dueAt=date.toISOString();}
    const sql=await getSql();
    if(leadId&&!(await sql.query("select id from leads where id=$1 limit 1",[leadId]))[0]) throw createError({statusCode:404,statusMessage:"لید انتخاب‌شده پیدا نشد."});
    if(propertyId&&!(await sql.query("select id from properties where id=$1 limit 1",[propertyId]))[0]) throw createError({statusCode:404,statusMessage:"فایل انتخاب‌شده پیدا نشد."});
    const fileName=String(session.pathname).split("/").pop()||"document";
    const rows=await sql.query<Record<string,unknown>>(
      "insert into admin_documents(id,lead_id,property_id,title,document_type,status,file_url,media_id,file_name,mime_type,size_bytes,notes,due_at) values($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12) returning *",
      [crypto.randomUUID(),leadId||null,propertyId||null,text.title,documentType,"/api/admin-document-media/"+stored.id,stored.id,fileName,String(session.content_type??"application/octet-stream"),totalBytes,notes,dueAt],
    );
    if(leadId) await sql.query("insert into lead_activities(lead_id,activity_type,title,note,metadata) values($1,'document',$2,$3,$4::jsonb)",[leadId,"سند جدید اضافه شد",text.title,JSON.stringify({documentId:rows[0]?.id??"",documentType})]);
    return {document:{id:String(rows[0]?.id??""),leadId:leadId||null,propertyId:propertyId||null,title:text.title,documentType,status:"pending",
      fileUrl:"/api/admin-document-media/"+stored.id,fileName,mimeType:String(session.content_type??"application/octet-stream"),sizeBytes:totalBytes,notes,dueAt,
      createdAt:new Date(String(rows[0]?.created_at??new Date().toISOString())).toISOString()}};
  },
}));
