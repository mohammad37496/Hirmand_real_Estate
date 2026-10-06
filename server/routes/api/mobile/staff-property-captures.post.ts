import { createError, defineEventHandler, getHeader, readRawBody, setResponseHeader } from "h3";
import { createHash, randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { requireStaffMobileDevice } from "@/lib/staff-mobile-auth.server";
import { consumeStaffMobileRateLimit } from "@/lib/staff-mobile-rate-limit.server";

const MAX_BYTES = 10 * 1024 * 1024;
const MIMES = new Set(["image/jpeg","image/png","image/webp"]);

function clean(value: string | undefined, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });

  const device = await requireStaffMobileDevice(event);
  const rate = consumeStaffMobileRateLimit("staff-capture-upload", device.device_id, {
    windowMs: 10*60*1000, maxHits: 40, blockMs: 10*60*1000,
  });
  if (!rate.allowed) throw createError({ statusCode: 429, statusMessage: "تعداد بارگذاری تصاویر بیش از حد مجاز است." });

  const raw = await readRawBody(event);
  const bytes = raw ? Buffer.from(raw) : Buffer.alloc(0);
  if (!bytes.length || bytes.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: "حجم تصویر مجاز نیست." });

  const mime = clean(getHeader(event,"x-hirmand-file-mime") || getHeader(event,"content-type"),60).split(";")[0].toLowerCase();
  if (!MIMES.has(mime)) throw createError({ statusCode: 415, statusMessage: "فرمت تصویر مجاز نیست." });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sql = await getSql();
  const duplicate = await sql.query<{id:string;file_id:string}>("select id,file_id from staff_mobile_property_captures c join staff_mobile_files f on f.id=c.file_id where c.device_id=$1 and f.sha256=$2 limit 1",[device.device_id,sha256]);
  if (duplicate[0]) return { success:true, duplicate:true, captureId:duplicate[0].id, fileId:duplicate[0].file_id };

  const fileId=randomUUID(), captureId=randomUUID();
  const extension=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
  const fileName="hirmand-property-"+captureId+"."+extension;
  const propertyId=clean(getHeader(event,"x-hirmand-property-id"),160);
  const visitId=clean(getHeader(event,"x-hirmand-visit-id"),160);
  const category=clean(getHeader(event,"x-hirmand-capture-category"),60) || "general";
  const caption=clean(getHeader(event,"x-hirmand-capture-caption"),500);

  await sql.query("insert into staff_mobile_files(id,device_id,name,mime_type,size_bytes,sha256,content) values($1,$2,$3,$4,$5,$6,$7)",[fileId,device.device_id,fileName,mime,bytes.length,sha256,bytes]);
  await sql.query("insert into staff_mobile_property_captures(id,staff_id,device_id,property_id,visit_id,file_id,category,caption) values($1,$2,$3,$4,$5,$6,$7,$8)",[captureId,device.staff_id,device.device_id,propertyId||null,visitId||null,fileId,category,caption]);
  return {success:true,duplicate:false,captureId,fileId};
});
