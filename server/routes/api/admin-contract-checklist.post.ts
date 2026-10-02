import { createError, defineEventHandler, getCookie, readBody, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session.server";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

const ITEMS = [
  ["buyer_identity", "احراز هویت خریدار / مستأجر"],
  ["seller_identity", "احراز هویت مالک / موجر"],
  ["property_docs", "بررسی سند و مدارک ملک"],
  ["inquiries", "استعلام‌ها و بررسی‌های لازم"],
  ["deal_terms", "ثبت مبلغ و شرایط نهایی"],
  ["contract_draft", "پیش‌نویس قرارداد"],
  ["commission", "ثبت و تسویه کمیسیون"],
  ["handover", "تحویل / تسویه نهایی"],
] as const;

async function requireAdmin(event: H3Event) {
  if (!await verifyAdminSessionToken(getCookie(event, ADMIN_SESSION_COOKIE))) throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  assertSameOrigin(event);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  await requireAdmin(event);
  const body = (await readBody(event).catch(() => ({}))) as {
    action?: "list" | "toggle";
    leadId?: string;
    itemKey?: string;
    done?: boolean;
  };

  if (dbSource === "unconfigured") {
    return { contracts: [], items: ITEMS.map(([key, label]) => ({ key, label })) };
  }

  const sql = await getSql();

  if (body.action === "toggle") {
    const leadId = String(body.leadId ?? "").trim();
    const item = ITEMS.find(([key]) => key === body.itemKey);
    if (!leadId || !item) throw createError({ statusCode: 400, statusMessage: "اطلاعات چک‌لیست نامعتبر است." });

    const title = "چک‌لیست قرارداد: " + item[1];
    const existing = await sql.query<{ id: string }>(
      "select id from admin_tasks where entity_type='lead' and entity_id=$1 and title=$2 limit 1",
      [leadId, title],
    );

    if (existing[0]) {
      await sql.query(
        "update admin_tasks set status=$2,updated_at=current_timestamp where id=$1",
        [existing[0].id, body.done ? "done" : "open"],
      );
    } else {
      await sql.query(
        "insert into admin_tasks(id,title,description,status,priority,due_at,assignee,entity_type,entity_id) values($1,$2,$3,$4,'normal',null,'','lead',$5)",
        [crypto.randomUUID(), title, "چک‌لیست داخلی قرارداد برای مرحله معامله.", body.done ? "done" : "open", leadId],
      );
    }
    return { success: true, leadId, itemKey: item[0], done: Boolean(body.done) };
  }

  const rows = await sql.query<Record<string, unknown>>(
    "select l.id,l.name,l.phone,l.consultant,l.deal,l.neighborhood,l.property_id,l.status,l.created_at," +
    "p.slug as property_slug,p.title as property_title " +
    "from leads l left join properties p on p.id::text=l.property_id::text " +
    "where l.status='contract' order by l.updated_at desc,l.created_at desc limit 80",
  );
  const tasks = await sql.query<Record<string, unknown>>(
    "select entity_id,title,status,updated_at from admin_tasks " +
    "where entity_type='lead' and title like 'چک‌لیست قرارداد:%' order by updated_at desc limit 1000",
  );
  const byLead = new Map<string, Record<string, unknown>[]>();
  for (const task of tasks) {
    const id = String(task.entity_id ?? "");
    if (!id) continue;
    const list = byLead.get(id) ?? [];
    list.push(task);
    byLead.set(id, list);
  }

  return {
    items: ITEMS.map(([key, label]) => ({ key, label })),
    contracts: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "مشتری"),
      phone: String(row.phone ?? ""),
      consultant: String(row.consultant ?? ""),
      deal: String(row.deal ?? ""),
      neighborhood: String(row.neighborhood ?? ""),
      propertySlug: row.property_slug == null ? null : String(row.property_slug),
      propertyTitle: row.property_title == null ? null : String(row.property_title),
      createdAt: new Date(String(row.created_at)).toISOString(),
      tasks: (byLead.get(String(row.id)) ?? []).map((task) => ({
        key: ITEMS.find(([key, label]) => ("چک‌لیست قرارداد: " + label) === String(task.title))?.[0] ?? null,
        title: String(task.title),
        done: String(task.status) === "done",
        updatedAt: task.updated_at == null ? null : new Date(String(task.updated_at)).toISOString(),
      })).filter((task) => task.key),
    })),
  };
});
