import { createError, defineEventHandler, getCookie, getQuery } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireAdmin(event: Parameters<typeof getCookie>[0]) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده تنظیم نشده است." });
  }

  const sql = await getSql();
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code.trim().toUpperCase() : "";

  if (code) {
    const rows = await sql.query(
      "select m.id,m.tracking_token as \"trackingCode\",m.sender_type as \"senderType\",m.sender_name as \"senderName\",m.message,m.created_at as \"createdAt\",l.name as \"customerName\",l.phone as \"customerPhone\",l.consultant,l.deal from customer_messages m join leads l on l.id=m.lead_id where upper(m.tracking_token)=upper($1) order by m.created_at asc limit 200",
      [code],
    );
    await sql.query(
      "update customer_messages set read_by_admin_at=current_timestamp where tracking_token=$1 and sender_type='customer' and read_by_admin_at is null",
      [code],
    );
    return { conversations: rows };
  }

  const conversations = await sql.query(
    "select m.tracking_token as \"trackingCode\",max(m.created_at) as \"lastMessageAt\",count(*)::int as \"messageCount\",count(*) filter (where m.sender_type='customer' and m.read_by_admin_at is null)::int as \"unreadCount\",max(l.name) as \"customerName\",max(l.phone) as \"customerPhone\",max(l.consultant) as \"consultant\",max(l.deal) as \"deal\",max(m.message) keep (dense_rank last order by m.created_at) as \"lastMessage\" from customer_messages m join leads l on l.id=m.lead_id group by m.tracking_token order by max(m.created_at) desc limit 100",
  );
  return {
    conversations: conversations.map((item) => item),
  };
});
