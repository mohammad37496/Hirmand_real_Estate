import { createError, defineEventHandler, getCookie, setResponseHeader } from "h3";
import { getCustomerIdentity } from "@/lib/customer-identity.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { getSql } from "@/lib/db";

const COOKIE_NAME = "hirmand_visitor_id";



export default defineEventHandler(async (event) => {
  assertSameOrigin(event);
  setResponseHeader(event, "cache-control", "no-store");
  const { visitorId, userId } = await getCustomerIdentity(event);
  if (!userId) throw createError({ statusCode: 401, statusMessage: "ابتدا وارد حساب کاربری شوید." });
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
