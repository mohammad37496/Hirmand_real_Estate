-- Unified first-party CRM links, durable offline sync events and daily reporting.
-- Independent from legacy Phone Bridge.

alter table staff_mobile_tasks
  add column if not exists automation_key text;

create unique index if not exists staff_mobile_tasks_automation_uidx
  on staff_mobile_tasks (automation_key)
  where automation_key is not null;

alter table staff_mobile_crm_contacts
  add column if not exists lead_id text;

create index if not exists staff_mobile_crm_contacts_lead_idx
  on staff_mobile_crm_contacts (lead_id)
  where lead_id is not null;

create table if not exists staff_mobile_crm_contact_properties (
  contact_id text not null,
  property_id text not null,
  relation_type text not null default 'interested'
    check (relation_type in ('interested','viewing','owner','buyer','tenant','seller','related')),
  notes text not null default '',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  primary key (contact_id, property_id)
);

create index if not exists staff_mobile_crm_cp_property_idx
  on staff_mobile_crm_contact_properties (property_id, updated_at desc);

create index if not exists staff_mobile_crm_cp_contact_idx
  on staff_mobile_crm_contact_properties (contact_id, updated_at desc);

create table if not exists staff_mobile_sync_events (
  event_id text primary key,
  device_id text not null,
  staff_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default current_timestamp
);

create index if not exists staff_mobile_sync_events_device_time_idx
  on staff_mobile_sync_events (device_id, received_at desc);

create index if not exists staff_mobile_sync_events_retention_idx
  on staff_mobile_sync_events (received_at);

create table if not exists staff_mobile_daily_reports (
  id text primary key,
  staff_id text not null,
  report_date date not null,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index if not exists staff_mobile_daily_reports_staff_date_uidx
  on staff_mobile_daily_reports (staff_id, report_date);

create index if not exists staff_mobile_daily_reports_date_idx
  on staff_mobile_daily_reports (report_date desc);
