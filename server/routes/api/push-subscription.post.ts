import { createError, defineEventHandler, getQuery, readBody, setResponseHeader } from "h3";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const schema = z.object({
  action: z.enum(["subscribe","unsubscribe"]).default("subscribe"),
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(256),
    auth: z.string().min(8).max(256),
  }).optional(),
});

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "اشتراک اعلان نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false };

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();

  if (parsed.data.action === "unsubscribe") {
    await sql.query("delete from customer_push_subscriptions where endpoint=$1", [parsed.data.endpoint]);
    return { enabled: true, subscribed: false };
  }

  if (!parsed.data.keys) throw createError({ statusCode: 400, statusMessage: "کلید اشتراک اعلان ارسال نشده است." });
  if (!parsed.data.endpoint.startsWith("https://")) throw createError({ statusCode: 400, statusMessage: "آدرس سرویس اعلان نامعتبر است." });

  const userAgent = String(event.req.headers.get("user-agent") ?? "").slice(0, 500);
  await sql.query(
    `insert into customer_push_subscriptions(endpoint,visitor_id,user_id,p256dh,auth,user_agent)
     values($1,$2,$3,$4,$5,$6)
     on conflict(endpoint) do update set visitor_id=excluded.visitor_id,user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=current_timestamp`,
    [parsed.data.endpoint, visitorId, userId, parsed.data.keys.p256dh, parsed.data.keys.auth, userAgent],
  );
  return { enabled: true, subscribed: true };
});
