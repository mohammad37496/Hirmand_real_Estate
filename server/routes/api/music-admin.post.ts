import { defineEventHandler, readBody, createError } from "h3";
import { dbSource, getSql } from "@/lib/db";

type Action = "list" | "toggle" | "delete";
function requireAdmin(adminKey: string | undefined) {
  const expected = process.env.HIRMAND_ADMIN_KEY?.trim();
  if (!expected || !adminKey || adminKey.trim() !== expected) {
    throw createError({ statusCode: 401, statusMessage: "کلید مدیریت نادرست است." });
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { action?: Action; adminKey?: string; id?: string; active?: boolean };
  requireAdmin(body.adminKey);
  if (dbSource === "unconfigured") {
    if (body.action === "list") return { tracks: [] };
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده برای مدیریت موسیقی تنظیم نشده است." });
  }
  const sql = await getSql();
  const action = body.action ?? "list";
  if (action === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      `select id, title, artist, url, mime_type, size_bytes, active, position, created_at
       from music_tracks order by position asc, created_at desc`,
    );
    return { tracks: rows.map((row) => ({
      id: String(row.id), title: String(row.title), artist: String(row.artist ?? ""), url: String(row.url),
      mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes) || 0, active: Boolean(row.active),
      position: Number(row.position) || 0, createdAt: new Date(String(row.created_at)).toISOString(),
    })) };
  }
  if (!body.id) throw createError({ statusCode: 400, statusMessage: "شناسه آهنگ مشخص نیست." });
  if (action === "toggle") {
    await sql.query("update music_tracks set active = $2, updated_at = current_timestamp where id = $1", [body.id, body.active === true]);
    return { success: true };
  }
  if (action === "delete") {
    await sql.query("delete from music_tracks where id = $1", [body.id]);
    return { success: true };
  }
  throw createError({ statusCode: 400, statusMessage: "عملیات مدیریت موسیقی نامعتبر است." });
});