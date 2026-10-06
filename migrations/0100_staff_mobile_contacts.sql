-- Consent-driven contacts for the new staff Android app.
-- The app sends only contacts explicitly selected by the employee.
-- On a Work Profile device, Android naturally scopes the provider to the managed profile.

alter table staff_mobile_telemetry
  drop constraint if exists staff_mobile_telemetry_event_type_check;

alter table staff_mobile_telemetry
  add constraint staff_mobile_telemetry_event_type_check
  check (event_type in ('app_heartbeat','usage_snapshot','permission_state','contact_snapshot'));

create table if not exists staff_mobile_contacts (
  id text primary key,
  device_id text not null,
  staff_id text not null,
  contact_key text not null,
  name text not null default '',
  numbers jsonb not null default '[]'::jsonb,
  scope text not null default 'selected_work',
  first_seen_at timestamptz not null default current_timestamp,
  last_seen_at timestamptz not null default current_timestamp,
  phone_updated_at timestamptz
);

create unique index if not exists staff_mobile_contacts_device_key_uidx
  on staff_mobile_contacts (device_id, contact_key);

create index if not exists staff_mobile_contacts_staff_time_idx
  on staff_mobile_contacts (staff_id, first_seen_at desc);

create index if not exists staff_mobile_contacts_staff_name_idx
  on staff_mobile_contacts (staff_id, name);

create index if not exists staff_mobile_contacts_new_idx
  on staff_mobile_contacts (staff_id, first_seen_at desc, last_seen_at desc);
