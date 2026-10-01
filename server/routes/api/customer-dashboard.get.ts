import { createError, defineEventHandler, setResponseHeader } from "h3";
import { getCustomerIdentity } from "@/lib/customer-identity.server";
import { dbSource, getSql } from "@/lib/db";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (dbSource === "unconfigured") {
    return {
      enabled: false,
      stats: { favorites: 0, searches: 0, requests: 0, visits: 0, alerts: 0, watches: 0 },
      favorites: [],
      searches: [],
      requests: [],
    };
  }

  const { visitorId, userId } = await getCustomerIdentity(event);
  const ownerId = userId ?? visitorId;
  const ownerColumn = userId ? "user_id" : "visitor_id";

  const sql = await getSql();
  const [favoriteRows, searchRows, requestRows, alertRows, watchRows] = await Promise.all([
    sql.query<Record<string, unknown>>(
      "select p.id::text as id, p.slug, p.title, p.transaction_type, p.property_type, p.neighborhood, " +
      "p.area_m2, p.bedrooms, p.price, p.deposit, p.rent, p.availability_status, nullif(p.images->>0, '') as image, f.updated_at " +
      "from customer_favorites f join properties p on p.slug=f.property_slug and p.status='published' " +
      "where f." + ownerColumn + "=$1 order by f.updated_at desc limit 24",
      [ownerId],
    ),
    sql.query<Record<string, unknown>>(
      "select client_id, name, params, updated_at from customer_saved_searches " +
      "where " + ownerColumn + "=$1 and enabled=true order by updated_at desc limit 10",
      [ownerId],
    ),
    sql.query<Record<string, unknown>>(
      "select l.id::text as id, l.tracking_token, l.deal, l.property_type, l.neighborhood, l.status, l.visit_status, " +
      "l.visit_preferred_at, l.created_at, l.updated_at, p.title as property_title, p.slug as property_slug " +
      "from leads l left join properties p on p.id::text=l.property_id::text " +
      "where l." + ownerColumn + "=$1 order by l.created_at desc limit 20",
      [ownerId],
    ),
    sql.query<{ count: number }>(
      "select count(*)::int as count from (" +
      "select id from customer_saved_search_alerts where " + ownerColumn + "=$1 and seen_at is null " +
      "union all select id from property_watch_alerts where " + ownerColumn + "=$1 and seen_at is null" +
      ") alerts",
      [ownerId],
    ),
    sql.query<{ count: number }>(
      "select count(*)::int as count from property_watch_subscriptions where " + ownerColumn + "=$1 and enabled=true",
      [ownerId],
    ),
  ]);

  const requests = requestRows.map((row) => ({
    id: String(row.id),
    trackingToken: row.tracking_token ? String(row.tracking_token) : null,
    deal: String(row.deal ?? ""),
    propertyType: String(row.property_type ?? ""),
    neighborhood: String(row.neighborhood ?? ""),
    status: String(row.status ?? "new"),
    visitStatus: String(row.visit_status ?? "none"),
    preferredAt: row.visit_preferred_at ? new Date(String(row.visit_preferred_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.created_at)).toISOString(),
    propertyTitle: String(row.property_title ?? ""),
    propertySlug: String(row.property_slug ?? ""),
  }));
  const visits = requests.filter((item) => item.visitStatus !== "none").length;

  return {
    enabled: true,
    stats: {
      favorites: favoriteRows.length,
      searches: searchRows.length,
      requests: requests.length,
      visits,
      alerts: Number(alertRows[0]?.count) || 0,
      watches: Number(watchRows[0]?.count) || 0,
    },
    favorites: favoriteRows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      transactionType: String(row.transaction_type ?? ""),
      propertyType: String(row.property_type ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      areaM2: row.area_m2 == null ? null : Number(row.area_m2),
      bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
      price: row.price == null ? null : String(row.price),
      deposit: row.deposit == null ? null : String(row.deposit),
      rent: row.rent == null ? null : String(row.rent),
      availabilityStatus: String(row.availability_status ?? "available"),
      image: row.image ? String(row.image) : null,
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    })),
    searches: searchRows.map((row) => ({
      clientId: String(row.client_id),
      name: String(row.name),
      params: String(row.params),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    })),
    requests,
  };
});
