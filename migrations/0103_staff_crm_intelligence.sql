-- Advanced CRM intelligence: lead scoring, visit feedback/checklist, and analytics indexes.
alter table leads
  add column if not exists lead_score smallint not null default 0,
  add column if not exists lead_score_band text not null default 'cold',
  add column if not exists lead_score_factors jsonb not null default '{}'::jsonb,
  add column if not exists lead_score_updated_at timestamptz;

create index if not exists leads_lead_score_idx
  on leads (lead_score desc, updated_at desc)
  where status not in ('closed','spam');

alter table staff_mobile_visits
  add column if not exists outcome text not null default 'pending',
  add column if not exists customer_interest_score smallint,
  add column if not exists customer_feedback text not null default '',
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists checklist_completed_at timestamptz;

create index if not exists staff_mobile_visits_followup_idx
  on staff_mobile_visits (staff_id, next_follow_up_at asc)
  where next_follow_up_at is not null;

create index if not exists staff_mobile_visits_outcome_idx
  on staff_mobile_visits (outcome, scheduled_at desc);

create index if not exists staff_mobile_crm_contact_properties_property_idx2
  on staff_mobile_crm_contact_properties (property_id, relation_type, updated_at desc);
