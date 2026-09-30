import { createError, defineEventHandler, getCookie, getHeader, getRouterParam, setResponseHeader, type H3Event } from "h3";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { getMediaMeta, readMediaRange } from "@/lib/media-store.server";

async function requireAdmin(event:H3Event){if(!await verifyAdminSessionToken(getCookie(event,ADMIN_SESSION_COOKIE)))throw createError({statusCode:401,statusMessage:"نشست مدیریت معتبر نیست. دوباره وارد پنل شوید."});
  assertSameOrigin(event);}
function parseRangeHeader(header:string|undefined,size:number){
  if(!header)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(header.trim());if(!match)return null;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]||0));const end=match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=size)return"unsatisfiable" as const;return{start,end};
}
export default defineEventHandler(async(event:H3Event)=>{
  await requireAdmin(event);const id=getRouterParam(event,"id")?.trim();if(!id)throw createError({statusCode:400,statusMessage:"شناسه سند نامعتبر است."});
  const meta=await getMediaMeta(id);if(!meta||!meta.pathname.startsWith("admin/documents/"))throw createError({statusCode:404,statusMessage:"سند پیدا نشد."});
  const range=parseRangeHeader(getHeader(event,"range"),meta.sizeBytes);if(range==="unsatisfiable"){setResponseHeader(event,"content-range","bytes */"+meta.sizeBytes);throw createError({statusCode:416,statusMessage:"بازه درخواست نامعتبر است."});
  }
  const result=await readMediaRange(id,range?range.start:0,range?range.end:null);if(!result)throw createError({statusCode:404,statusMessage:"سند پیدا نشد."});
  const headers={"cache-control":"private, no-store","content-type":result.contentType,"content-length":String(result.bytes.length),"content-disposition":'attachment; filename="document"',"x-content-type-options":"nosniff",
    ...(range?{"content-range":"bytes "+range.start+"-"+(range.start+result.bytes.length-1)+"/"+meta.sizeBytes}: {})};
  return new Response(new Uint8Array(result.bytes),{status:range?206:200,headers});
});
