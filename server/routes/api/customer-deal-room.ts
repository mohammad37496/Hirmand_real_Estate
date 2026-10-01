import { createError, defineEventHandler, readBody, getQuery, setResponseHeader } from "h3";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";
import { dbSource, getSql } from "@/lib/db";
import { getCustomerIdentity } from "@/lib/customer-identity.server";

const schema = z.object({
  action: z.enum(["list","get","create","add","remove","update","share","add_document","remove_document"]),
  roomId: z.string().trim().max(80).optional(),
  token: z.string().trim().max(120).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(3000).optional(),
  slugs: z.array(z.string().trim().min(1).max(220)).max(30).optional(),
  slug: z.string().trim().min(1).max(220).optional(),
  privateNote: z.string().trim().max(1000).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  url: z.string().url().max(2048).optional(),
  kind: z.string().trim().max(40).optional(),
});

function cleanSlugs(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((v) => v.trim()).filter(Boolean))).slice(0, 30);
}

async function owner(event: Parameters<ReturnType<typeof defineEventHandler>>[0]) {
  return getCustomerIdentity(event as never);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  const rawQuery = getQuery(event) as Record<string, unknown>;
  const body = event.req.method === "GET" ? {} : await readBody(event).catch(() => ({}));
  const parsed = schema.safeParse({ ...body, ...(rawQuery.action ? { action: rawQuery.action } : {}), ...(rawQuery.token ? { token: rawQuery.token } : {}), ...(rawQuery.roomId ? { roomId: rawQuery.roomId } : {}) });
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: "درخواست اتاق معامله نامعتبر است." });
  if (dbSource === "unconfigured") return { enabled: false, rooms: [], room: null };

  const isSharedRead = Boolean(parsed.data.token) && ["get","list"].includes(parsed.data.action);
  if (!isSharedRead) assertSameOrigin(event);

  const { visitorId, userId } = await getCustomerIdentity(event);
  const sql = await getSql();
  const ownerColumn = userId ? "user_id" : "visitor_id";
  const ownerId = userId ?? visitorId;

  async function fetchRoom(id: string, token?: string) {
    const roomRows = token
      ? await sql.query<Record<string, unknown>>("select id,name,status,share_token,notes,created_at,updated_at from customer_deal_rooms where share_token=$1 and status='open' limit 1", [token])
      : await sql.query<Record<string, unknown>>("select id,name,status,share_token,notes,created_at,updated_at from customer_deal_rooms where id=$1 and "+ownerColumn+"=$2 limit 1", [id, ownerId]);
    const room = roomRows[0];
    if (!room) throw createError({ statusCode: 404, statusMessage: "اتاق معامله پیدا نشد." });
    const items = await sql.query<Record<string, unknown>>(
      "select i.property_slug,i.private_note,i.sort_order,i.created_at,p.id::text as property_id,p.title,p.transaction_type,p.property_type,p.neighborhood,p.area_m2,p.bedrooms,p.price,p.deposit,p.rent,p.availability_status,nullif(p.images->>0,'') as image " +
      "from customer_deal_room_items i left join properties p on p.slug=i.property_slug and p.status='published' where i.room_id=$1 order by i.sort_order asc,i.created_at desc",
      [String(room.id)],
    );
    const docs = await sql.query<Record<string, unknown>>("select id,title,url,kind,note,created_at from customer_deal_room_documents where room_id=$1 order by created_at desc", [String(room.id)]);
    return {
      id: String(room.id),
      name: String(room.name),
      status: String(room.status),
      shareToken: room.share_token ? String(room.share_token) : null,
      notes: String(room.notes ?? ""),
      createdAt: new Date(String(room.created_at)).toISOString(),
      updatedAt: new Date(String(room.updated_at)).toISOString(),
      items: items.map((row) => ({
        slug: String(row.property_slug),
        privateNote: String(row.private_note ?? ""),
        title: row.title ? String(row.title) : "فایل حذف‌شده",
        propertyId: row.property_id ? String(row.property_id) : null,
        transactionType: row.transaction_type ? String(row.transaction_type) : "",
        propertyType: row.property_type ? String(row.property_type) : "",
        neighborhood: row.neighborhood ? String(row.neighborhood) : "",
        areaM2: row.area_m2 == null ? null : Number(row.area_m2),
        bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
        price: row.price == null ? null : String(row.price),
        deposit: row.deposit == null ? null : String(row.deposit),
        rent: row.rent == null ? null : String(row.rent),
        availabilityStatus: row.availability_status ? String(row.availability_status) : "available",
        image: row.image ? String(row.image) : null,
      })),
      documents: docs.map((row) => ({
        id: String(row.id), title: String(row.title), url: String(row.url),
        kind: String(row.kind ?? "link"), note: String(row.note ?? ""),
        createdAt: new Date(String(row.created_at)).toISOString(),
      })),
    };
  }

  if (parsed.data.action === "list") {
    const rooms = await sql.query<Record<string, unknown>>(
      "select id,name,status,share_token,notes,created_at,updated_at from customer_deal_rooms where "+ownerColumn+"=$1 order by updated_at desc limit 20",
      [ownerId],
    );
    return { enabled: true, rooms: rooms.map((row) => ({
      id: String(row.id), name: String(row.name), status: String(row.status),
      shareToken: row.share_token ? String(row.share_token) : null,
      notes: String(row.notes ?? ""), updatedAt: new Date(String(row.updated_at)).toISOString(),
    })) };
  }

  if (parsed.data.action === "get") {
    const id = parsed.data.roomId ?? "";
    return { enabled: true, room: await fetchRoom(id, isSharedRead ? parsed.data.token : undefined) };
  }

  if (parsed.data.action === "create") {
    const slugs = cleanSlugs(parsed.data.slugs);
    if (!slugs.length) throw createError({ statusCode: 400, statusMessage: "حداقل یک فایل برای اتاق معامله انتخاب کنید." });
    const roomId = crypto.randomUUID();
    await sql.query("insert into customer_deal_rooms(id,visitor_id,user_id,name,notes) values($1,$2,$3,$4,$5)", [roomId,visitorId,userId,parsed.data.name ?? "اتاق معامله من",parsed.data.notes ?? ""]);
    await sql.query(
      "insert into customer_deal_room_items(room_id,property_slug,sort_order) select $1,item,ord from unnest($2::text[]) with ordinality as t(item,ord) on conflict(room_id,property_slug) do nothing",
      [roomId,slugs],
    );
    return { enabled: true, room: await fetchRoom(roomId) };
  }

  const roomId = parsed.data.roomId ?? "";
  if (!roomId) throw createError({ statusCode: 400, statusMessage: "اتاق معامله مشخص نشده است." });
  const access = await sql.query<{ id: string }>("select id from customer_deal_rooms where id=$1 and "+ownerColumn+"=$2 limit 1",[roomId,ownerId]);
  if (!access[0]) throw createError({ statusCode: 404, statusMessage: "اتاق معامله پیدا نشد." });

  if (parsed.data.action === "add") {
    if (!parsed.data.slug) throw createError({ statusCode: 400, statusMessage: "فایل مشخص نشده است." });
    await sql.query("insert into customer_deal_room_items(room_id,property_slug,private_note,sort_order) values($1,$2,$3,coalesce((select max(sort_order)+1 from customer_deal_room_items where room_id=$1),0)) on conflict(room_id,property_slug) do update set private_note=excluded.private_note",[roomId,parsed.data.slug,parsed.data.privateNote ?? ""]);
  }
  if (parsed.data.action === "remove") {
    if (!parsed.data.slug) throw createError({ statusCode: 400, statusMessage: "فایل مشخص نشده است." });
    await sql.query("delete from customer_deal_room_items where room_id=$1 and property_slug=$2",[roomId,parsed.data.slug]);
  }
  if (parsed.data.action === "update") {
    await sql.query("update customer_deal_rooms set name=coalesce($3,name),notes=coalesce($4,notes),updated_at=current_timestamp where id=$1 and "+ownerColumn+"=$2",[roomId,ownerId,parsed.data.name ?? null,parsed.data.notes ?? null]);
  }
  if (parsed.data.action === "share") {
    const token=crypto.randomUUID().replace(/-/g,"");
    await sql.query("update customer_deal_rooms set share_token=$3,updated_at=current_timestamp where id=$1 and "+ownerColumn+"=$2",[roomId,ownerId,token]);
  }
  if (parsed.data.action === "add_document") {
    if (!parsed.data.title || !parsed.data.url) throw createError({ statusCode: 400, statusMessage: "عنوان و لینک مدرک لازم است." });
    await sql.query("insert into customer_deal_room_documents(room_id,title,url,kind,note) values($1,$2,$3,$4,$5)",[roomId,parsed.data.title,parsed.data.url,parsed.data.kind ?? "link",parsed.data.notes ?? parsed.data.privateNote ?? ""]);
  }
  if (parsed.data.action === "remove_document") {
    const id=Number(parsed.data.slug);
    if(!Number.isInteger(id)||id<=0) throw createError({statusCode:400,statusMessage:"شناسه مدرک نامعتبر است."});
    await sql.query("delete from customer_deal_room_documents where id=$1 and room_id=$2",[id,roomId]);
  }

  await sql.query("update customer_deal_rooms set updated_at=current_timestamp where id=$1",[roomId]);
  return { enabled: true, room: await fetchRoom(roomId) };
});