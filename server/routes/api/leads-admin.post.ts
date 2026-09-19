import { createError, defineEventHandler, readBody } from "h3";
import { dbSource, getSql } from "@/lib/db";

type Status = "new" | "contacted" | "closed" | "spam";
function requireAdmin(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey.trim() !== expected) throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { adminKey?: string; action?: "list" | "status" | "delete"; id?: string; status?: Status };
  requireAdmin(body.adminKey);
  if (dbSource === "unconfigured") return { leads: [] };
  const sql = await getSql();
  if ((body.action ?? "list") === "list") {
    const rows = await sql.query<Record<string, unknown>>(`select id,name,phone,deal,property_type,neighborhood,consultant,note,status,created_at from leads order by created_at desc limit 300`);
    return { leads: rows.map((row) => ({ id:String(row.id), name:String(row.name), phone:String(row.phone), deal:String(row.deal), propertyType:String(row.property_type ?? ""), neighborhood:String(row.neighborhood ?? ""), consultant:String(row.consultant ?? ""), note:String(row.note ?? ""), status:String(row.status) as Status, createdAt:new Date(String(row.created_at)).toISOString() })) };
  }
  if (!body.id) throw createError({ statusCode: 400, statusMessage: "شناسه درخواست مشخص نیست." });
  if (body.action === "status") {
    if (!body.status) throw createError({ statusCode: 400, statusMessage: "وضعیت مشخص نیست." });
    await sql.query("update leads set status=$2, updated_at=current_timestamp where id=$1", [body.id, body.status]);
    return { success: true };
  }
  if (body.action === "delete") {
    await sql.query("delete from leads where id=$1", [body.id]);
    return { success: true };
  }
  throw createError({ statusCode: 400, statusMessage: "عملیات نامعتبر است." });
});