import { createError, defineEventHandler, getCookie, setResponseHeader } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";

function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return /[",]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  if (dbSource === "unconfigured") {
    setResponseHeader(event, "content-type", "text/csv; charset=utf-8");
    return "\uFEFF";
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(`
    select id, title, slug, status, featured, featured_until, transaction_type, property_type,
           neighborhood, address, area_m2, bedrooms, bathrooms, floor, total_floors,
           built_year, parking, elevator, storage, price, deposit, rent,
           contact_name, contact_phone, created_at, updated_at
    from properties
    order by created_at desc
  `);

  const headers = [
    "شناسه","عنوان","slug","وضعیت","ویژه","پایان ویژه","معامله","نوع ملک","محله","آدرس",
    "متراژ","خواب","سرویس","طبقه","کل طبقات","سال ساخت","پارکینگ","آسانسور",
    "انباری","قیمت","رهن","اجاره","مشاور","تلفن","ایجاد","آخرین بروزرسانی"
  ];
  const statusLabels: Record<string,string> = {
    published: "منتشرشده", draft: "پیش‌نویس", archived: "بایگانی"
  };
  const transactionLabels: Record<string,string> = {
    sell: "فروش", buy: "خرید", rent: "اجاره", mortgage: "رهن"
  };

  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => [
      row.id, row.title, row.slug, statusLabels[String(row.status)] ?? row.status,
      row.featured ? "بله" : "خیر",
      row.featured_until ? new Date(String(row.featured_until)).toISOString() : "",
      transactionLabels[String(row.transaction_type)] ?? row.transaction_type,
      row.property_type, row.neighborhood, row.address, row.area_m2, row.bedrooms,
      row.bathrooms, row.floor, row.total_floors, row.built_year,
      row.parking ? "بله" : "خیر", row.elevator ? "بله" : "خیر",
      row.storage ? "بله" : "خیر", row.price, row.deposit, row.rent,
      row.contact_name, row.contact_phone, row.created_at, row.updated_at,
    ].map(csvCell).join(","))
  ];

  setResponseHeader(event, "content-type", "text/csv; charset=utf-8");
  setResponseHeader(event, "content-disposition", 'attachment; filename="hirmand-properties.csv"');
  return "\uFEFF" + lines.join("\n");
});
