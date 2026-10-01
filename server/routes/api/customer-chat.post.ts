import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const schema = z.object({
  action: z.enum(["list","messages","send","seen"]).default("list"),
  conversationId: z.string().trim().max(120).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  propertyId: z.string().trim().max(120).optional(),
  propertyTitle: z.string().trim().max(180).optional(),
});

function ownerWhere(userId: string | null, visitorId: string) {
  return userId
    ? { column: "user_id", value: userId }
    : { column: "visitor_id", value: visitorId };
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "درخواست چت نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, conversations: [], messages: [] };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();
  const owner = ownerWhere(userId, visitorId);

  if (parsed.data.action === "list") {
    const rows = await sql.query<Record<string, unknown>>(
      `select c.id,c.property_id,c.property_title,c.consultant_name,c.status,c.created_at,c.updated_at,c.last_message_at,
        coalesce((select count(*) from customer_messages m where m.conversation_id=c.id and m.sender_type in ('consultant','admin') and m.read_at is null),0)::int as unread_count,
        (select body from customer_messages m2 where m2.conversation_id=c.id order by m2.created_at desc,m2.id desc limit 1) as last_message
       from customer_conversations c
       where c.${owner.column}=$1
       order by coalesce(c.last_message_at,c.updated_at) desc
       limit 20`,
      [owner.value],
    );
    return {
      enabled: true,
      conversations: rows.map((row) => ({
        id: String(row.id),
        propertyId: row.property_id == null ? null : String(row.property_id),
        propertyTitle: String(row.property_title ?? ""),
        consultantName: String(row.consultant_name ?? ""),
        status: String(row.status),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        lastMessageAt: row.last_message_at == null ? null : new Date(String(row.last_message_at)).toISOString(),
        unreadCount: Number(row.unread_count) || 0,
        lastMessage: String(row.last_message ?? ""),
      })),
    };
  }

  if (parsed.data.action === "send" && !parsed.data.message) {
    throw createError({ statusCode: 400, statusMessage: "متن پیام را وارد کنید." });
  }

  let conversationId = parsed.data.conversationId;
  if (!conversationId && parsed.data.action === "send") {
    const rows = await sql.query<{ id: string }>(
      `insert into customer_conversations(id,visitor_id,user_id,property_id,property_title,status,last_message_at)
       values($1,$2,$3,$4,$5,'waiting_consultant',current_timestamp)
       returning id`,
      [crypto.randomUUID(), visitorId, userId, parsed.data.propertyId ?? null, parsed.data.propertyTitle ?? ""],
    );
    conversationId = rows[0]?.id;
  }

  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: "گفت‌وگو مشخص نشده است." });
  }

  const ownsConversation = await sql.query<{ id: string }>(
    `select id from customer_conversations where id=$1 and ${owner.column}=$2 limit 1`,
    [conversationId, owner.value],
  );
  if (!ownsConversation[0]) throw createError({ statusCode: 404, statusMessage: "گفت‌وگو پیدا نشد." });

  if (parsed.data.action === "messages") {
    const rows = await sql.query<Record<string, unknown>>(
      "select id,sender_type,sender_id,body,read_at,created_at from customer_messages where conversation_id=$1 order by created_at asc,id asc limit 200",
      [conversationId],
    );
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

  if (parsed.data.action === "seen") {
    await sql.query(
      "update customer_messages set read_at=coalesce(read_at,current_timestamp) where conversation_id=$1 and sender_type in ('consultant','admin') and read_at is null",
      [conversationId],
    );
    return { enabled: true, conversationId, seen: true };
  }

  await sql.query(
    "insert into customer_messages(conversation_id,sender_type,sender_id,body) values($1,'customer',$2,$3)",
    [conversationId, userId ?? visitorId, parsed.data.message!.trim()],
  );
  await sql.query(
    "update customer_conversations set status='waiting_consultant',updated_at=current_timestamp,last_message_at=current_timestamp,property_id=coalesce(property_id,$2),property_title=case when property_title='' then coalesce($3,'') else property_title end where id=$1",
    [conversationId, parsed.data.propertyId ?? null, parsed.data.propertyTitle ?? null],
  );
  return { enabled: true, conversationId, sent: true };
});
