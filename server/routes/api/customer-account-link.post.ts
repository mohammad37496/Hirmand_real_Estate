import { createError, defineEventHandler, getCookie, readBody, setResponseHeader } from "h3";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const COOKIE_NAME = "hirmand_visitor_id";

function headersFromEvent(event: Parameters<typeof defineEventHandler>[0] extends never ? never : any) {
  const headers = new Headers();
  const source = event.node.req.headers;
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return headers;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const session = await auth.api.getSession({ headers: headersFromEvent(event) }).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) throw createError({ statusCode: 401, statusMessage: "ابتدا وارد حساب کاربری شوید." });

  const visitorId = getCookie(event, COOKIE_NAME);
  if (!visitorId || !/^[a-f0-9-]{20,80}$/i.test(visitorId)) {
    return { linked: true, moved: 0 };
  }

  const sql = await getSql();
  const results = await Promise.all([
    sql.query("update customer_favorites set user_id=$1 where visitor_id=$2 and user_id is null", [userId, visitorId]),
    sql.query("update customer_saved_searches set user_id=$1 where visitor_id=$2 and user_id is null", [userId, visitorId]),
    sql.query("update property_watch_subscriptions set user_id=$1 where visitor_id=$2 and user_id is null", [userId, visitorId]),
    sql.query("update property_watch_alerts set user_id=$1 where visitor_id=$2 and user_id is null", [userId, visitorId]),
    sql.query("update leads set user_id=$1 where visitor_id=$2 and user_id is null", [userId, visitorId]),
  ]);
  return { linked: true, moved: results.reduce((sum, item) => sum + item.length, 0) };
});
