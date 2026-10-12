import { createError, defineEventHandler, readRawBody, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { requireSignedAttendanceCameraRequest } from "@/lib/attendance-camera-signature.server";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده فهرست کارکنان در دسترس نیست." });
  }
  const raw = await readRawBody(event);
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw ?? "");
  if (body.length > 1024) {
    throw createError({ statusCode: 413, statusMessage: "درخواست فهرست کارکنان معتبر نیست." });
  }
  await requireSignedAttendanceCameraRequest(event, body);

  const sql = await getSql();
  const rows = await sql.query<{ id: string; name: string; role: string }>(
    "select id,name,role from consultants where is_active=true order by sort_order asc,name asc",
  );
  return { ok: true, staff: rows.map((row) => ({ id: row.id, name: row.name, role: row.role })) };
});
