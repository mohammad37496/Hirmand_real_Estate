import { randomUUID } from "node:crypto";

type SqlLike = { query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]> };

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function runStaffFollowUpAutomation(sql: SqlLike, options?: { staffId?: string | null; limitPerStaff?: number }) {
  const staffFilter = clean(options?.staffId, 80);
  const limit = Math.max(1, Math.min(100, Number(options?.limitPerStaff) || 20));
  const staffRows = await sql.query<{ id: string; name: string }>(
    "select id,name from consultants where is_active=true " + (staffFilter ? "and id=$1 " : "") + "order by sort_order asc,name asc",
    staffFilter ? [staffFilter] : [],
  );

  let created = 0;
  let overdue = 0;

  for (const staff of staffRows) {
    const leadRows = await sql.query<Record<string, unknown>>(
      "select id,name,phone,deal,property_id,follow_up_at from leads " +
      "where coalesce(trim(consultant),'')=trim($1) and status in ('new','contacted','follow_up','visited','contract') " +
      "and follow_up_at is not null and follow_up_at <= current_timestamp + interval '7 days' " +
      "order by follow_up_at asc limit $2",
      [String(staff.name), limit],
    );

    for (const lead of leadRows) {
      const leadId = String(lead.id);
      const followUpAt = lead.follow_up_at ? new Date(String(lead.follow_up_at)) : null;
      if (!followUpAt || !Number.isFinite(followUpAt.getTime())) continue;
      if (followUpAt.getTime() <= Date.now()) overdue++;

      const contactRows = await sql.query<{ id: string }>(
        "select id from staff_mobile_crm_contacts where lead_id=$1 and staff_id=$2 order by updated_at desc limit 1",
        [leadId, String(staff.id)],
      );
      let contactId = contactRows[0]?.id ? String(contactRows[0].id) : null;

      if (!contactId) {
        contactId = randomUUID();
        await sql.query(
          "insert into staff_mobile_crm_contacts(id,staff_id,name,phone,type,notes,lead_id,property_id,next_follow_up_at) " +
          "values($1,$2,$3,$4,'customer',$5,$6,$7,$8)",
          [
            contactId,
            String(staff.id),
            String(lead.name ?? "").trim() || "مشتری",
            String(lead.phone ?? "").trim(),
            "پرونده مشتری از لید اصلی هیرمند به CRM کارکنان متصل شد.",
            leadId,
            lead.property_id ? String(lead.property_id) : null,
            followUpAt.toISOString(),
          ],
        );
      } else {
        await sql.query(
          "update staff_mobile_crm_contacts set name=$1,phone=$2,lead_id=$3,property_id=coalesce(property_id,$4),next_follow_up_at=$5,updated_at=current_timestamp " +
          "where id=$6 and staff_id=$7",
          [
            String(lead.name ?? "").trim() || "مشتری",
            String(lead.phone ?? "").trim(),
            leadId,
            lead.property_id ? String(lead.property_id) : null,
            followUpAt.toISOString(),
            contactId,
            String(staff.id),
          ],
        );
      }

      if (lead.property_id) {
        await sql.query(
          "insert into staff_mobile_crm_contact_properties(contact_id,property_id,relation_type) values($1,$2,'interested') " +
          "on conflict(contact_id,property_id) do update set updated_at=current_timestamp",
          [contactId, String(lead.property_id)],
        );
      }

      const taskRows = await sql.query<{ id: string }>(
        "select id from staff_mobile_tasks where automation_key=$1 limit 1",
        ["lead-followup:" + leadId],
      );

      if (!taskRows[0]) {
        const taskId = randomUUID();
        await sql.query(
          "insert into staff_mobile_tasks(id,staff_id,device_id,title,description,status,priority,property_id,customer_id,due_at,automation_key) " +
          "values($1,$2,null,$3,$4,'open',$5,$6,$7,$8,$9)",
          [
            taskId,
            String(staff.id),
            "پیگیری مشتری · " + String(lead.name ?? "مشتری"),
            "پیگیری خودکار CRM هیرمند برای لید " + leadId + ". شماره: " + String(lead.phone ?? "—"),
            followUpAt.getTime() <= Date.now() ? "urgent" : "high",
            lead.property_id ? String(lead.property_id) : null,
            contactId,
            followUpAt.toISOString(),
            "lead-followup:" + leadId,
          ],
        );
        created++;
      } else {
        await sql.query(
          "update staff_mobile_tasks set due_at=$1,property_id=coalesce(property_id,$2),customer_id=coalesce(customer_id,$3),updated_at=current_timestamp " +
          "where automation_key=$4 and status in ('open','in_progress')",
          [
            followUpAt.toISOString(),
            lead.property_id ? String(lead.property_id) : null,
            contactId,
            "lead-followup:" + leadId,
          ],
        );
      }
    }

    await sql.query(
      "insert into staff_mobile_daily_reports(id,staff_id,report_date,summary) values($1,$2,(current_timestamp at time zone 'Asia/Tehran')::date,$3::jsonb) " +
      "on conflict(staff_id,report_date) do update set summary=excluded.summary,updated_at=current_timestamp",
      [randomUUID(), String(staff.id), JSON.stringify({ generatedBy: "follow-up-automation" })],
    );
  }

  await sql.query("delete from staff_mobile_sync_events where received_at < current_timestamp - interval '30 days'").catch(() => {});
  return { created, overdue };
}