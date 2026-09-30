import { getSql } from "@/lib/db";

type Sql = Awaited<ReturnType<typeof getSql>>;

type RouteInput = {
  consultant?: string;
  neighborhood?: string;
  propertyType?: string;
  deal?: string;
};

type Candidate = {
  name: string;
  phone: string;
  openLeads: number;
  openTasks: number;
  neighborhoodFiles: number;
  score: number;
};

function transactionTypes(deal: string) {
  if (deal === "خرید") return ["sell"];
  if (deal === "فروش") return ["buy"];
  if (deal === "رهن" || deal === "اجاره") return ["rent", "mortgage"];
  return [];
}

export async function routeLeadConsultant(sql: Sql, input: RouteInput) {
  const explicit = String(input.consultant ?? "").trim();
  if (explicit) {
    return { consultant: explicit, reason: "manual" as const };
  }

  const consultants = await sql.query<Record<string, unknown>>(
    `select c.name, c.phone,
       count(distinct l.id) filter (
         where l.status in ('new','contacted','follow_up','visited')
       )::int as open_leads,
       count(distinct t.id) filter (
         where t.status='open' and (t.due_at is null or t.due_at >= current_timestamp)
       )::int as open_tasks
     from consultants c
     left join leads l on lower(trim(l.consultant))=lower(trim(c.name))
     left join admin_tasks t on lower(trim(t.assignee))=lower(trim(c.name))
     where c.is_active=true
     group by c.name,c.phone
     order by c.sort_order asc, c.name asc`,
  );

  if (!consultants.length) {
    return { consultant: "", reason: "no-active-consultant" as const };
  }

  const neighborhood = String(input.neighborhood ?? "").trim();
  const propertyType = String(input.propertyType ?? "").trim();
  const tx = transactionTypes(String(input.deal ?? "").trim());

  const neighborhoodRows = neighborhood
    ? await sql.query<Record<string, unknown>>(
        `select contact_name, count(*)::int as file_count
         from properties
         where status='published'
           and lower(trim(neighborhood))=lower(trim($1))
           and ($2::text = '' or property_type=$2)
           and (cardinality($3::text[]) = 0 or transaction_type=any($3::text[]))
           and nullif(trim(contact_name),'') is not null
         group by contact_name
         order by file_count desc
         limit 20`,
        [neighborhood, propertyType, tx],
      )
    : [];

  const coverage = new Map(
    neighborhoodRows.map((row) => [
      String(row.contact_name ?? "").trim().toLowerCase(),
      Number(row.file_count) || 0,
    ]),
  );

  const candidates: Candidate[] = consultants.map((row) => {
    const name = String(row.name ?? "").trim();
    const phone = String(row.phone ?? "").trim();
    const openLeads = Number(row.open_leads) || 0;
    const openTasks = Number(row.open_tasks) || 0;
    const neighborhoodFiles = coverage.get(name.toLowerCase()) ?? 0;

    const score =
      openLeads * 8 +
      openTasks * 3 -
      Math.min(neighborhoodFiles, 12) * 6;

    return { name, phone, openLeads, openTasks, neighborhoodFiles, score };
  });

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      a.openLeads - b.openLeads ||
      a.openTasks - b.openTasks ||
      a.name.localeCompare(b.name, "fa"),
  );

  const winner = candidates[0];
  if (!winner) {
    return { consultant: "", reason: "no-candidate" as const };
  }

  const reason: "neighborhood-owner" | "workload-balance" =
    winner.neighborhoodFiles > 0 ? "neighborhood-owner" : "workload-balance";

  return {
    consultant: winner.name,
    reason,
    details: {
      phone: winner.phone,
      openLeads: winner.openLeads,
      openTasks: winner.openTasks,
      neighborhoodFiles: winner.neighborhoodFiles,
      candidateCount: candidates.length,
    },
  };
}

export async function persistLeadRoutingActivity(
  sql: Sql,
  leadId: string,
  routing: Awaited<ReturnType<typeof routeLeadConsultant>>,
) {
  if (!routing.consultant || routing.reason === "manual" || routing.reason === "no-active-consultant") {
    return;
  }

  await sql.query(
    `insert into lead_activities
      (lead_id, activity_type, title, note, metadata)
     values ($1,'status',$2,$3,$4::jsonb)`,
    [
      leadId,
      "مشاور لید به‌صورت خودکار تعیین شد",
      "لید برای بررسی اولیه به «" + routing.consultant + "» تخصیص داده شد.",
      JSON.stringify({
        automatic: true,
        reason: routing.reason,
        details: routing.details ?? null,
      }),
    ],
  ).catch(() => {});
}
