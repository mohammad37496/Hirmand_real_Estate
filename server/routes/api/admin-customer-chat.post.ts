import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const schema = z.object({
  action: z.enum(["list","messages","send","status","assign"]).default("list"),
  conversationId: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(4000).optional(),
  status: z.enum(["open","waiting_customer","waiting_consultant","closed"]).optional(),
  consultantName: z.string().trim().max(120).optional(),
});

async function requireAdmin(event: Parameters<typeof defineEventHandler>[0]) {
  void event;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "درخواست صندوق پیام نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, conversations: [] };

  const sql = await getSql();
  if (parsed.data.action === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      `select c.id,c.visitor_id,c.user_id,c.property_id,c.property_title,c.consultant_name,c.status,c.created_at,c.updated_at,c.last_message_at,
        coalesce((select count(*) from customer_messages m where m.conversation_id=c.id and m.sender_type='customer' and m.read_at is null),0)::int as unread_count,
        (select body from customer_messages m2 where m2.conversation_id=c.id order by m2.created_at desc,m2.id desc limit 1) as last_message
       from customer_conversations c order by coalesce(c.last_message_at,c.updated_at) desc limit 100`,
    );
    return {
      enabled: true,
      conversations: rows.map((row) => ({
        id: String(row.id),
        propertyId: row.property_id == null ? null : String(row.property_id),
        propertyTitle: String(row.property_title ?? ""),
        consultantName: String(row.consultant_name ?? ""),
        status: String(row.status),
        visitorId: row.visitor_id == null ? null : String(row.visitor_id),
        userId: row.user_id == null ? null : String(row.user_id),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        lastMessageAt: row.last_message_at == null ? null : new Date(String(row.last_message_at)).toISOString(),
        unreadCount: Number(row.unread_count) || 0,
        lastMessage: String(row.last_message ?? ""),
      })),
    };
  }

  if (!parsed.data.conversationId) throw createError({ statusCode: 400, statusMessage: "گفت‌وگو مشخص نشده است." });
  const conversationId = parsed.data.conversationId;

  if (parsed.data.action === "messages") {
    const rows = await sql.query<Record<string, unknown>>(
      "select id,sender_type,sender_id,body,read_at,created_at from customer_messages where conversation_id=$1 order by created_at asc,id asc limit 300",
      [conversationId],
    );
    await sql.query("update customer_messages set read_at=coalesce(read_at,current_timestamp) where conversation_id=$1 and sender_type='customer' and read_at is null", [conversationId]);
    return {
      enabled: true,
      conversationId,
      messages: rows.map((row) => ({
        id: Number(row.id),
        senderType: String(row.sender_type),
        senderId: String(row.sender_id ?? ""),
        body: String(row.body),
        readAt: row.read_at == null ? null : new Date(String(row.read_at)).toISOString(),
        createdAt: new Date(String(row.created_at)).toISOString(),
      })),
    };
  }

  if (parsed.data.action === "status") {
    await sql.query("update customer_conversations set status=$2,updated_at=current_timestamp where id=$1", [conversationId, parsed.data.status ?? "open"]);
    return { success: true };
  }

  if (parsed.data.action === "assign") {
    await sql.query("update customer_conversations set consultant_name=$2,updated_at=current_timestamp where id=$1", [conversationId, parsed.data.consultantName?.trim() ?? ""]);
    return { success: true };
  }

  if (!parsed.data.message) throw createError({ statusCode: 400, statusMessage: "متن پاسخ را وارد کنید." });
  await sql.query(
    "insert into customer_messages(conversation_id,sender_type,sender_id,body) values($1,'admin',$2,$3)",
    [conversationId, "admin", parsed.data.message.trim()],
  );
  await sql.query(
    "update customer_conversations set status='waiting_customer',updated_at=current_timestamp,last_message_at=current_timestamp where id=$1",
    [conversationId],
  );
  return { success: true, sent: true };
});
