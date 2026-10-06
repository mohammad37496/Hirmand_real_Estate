-- First-party Hirmand staff operations: tasks, CRM, visits, attendance, captures, health and loss mode.
-- Independent from legacy Phone Bridge.

create table if not exists staff_mobile_tasks (
  id text primary key,
  staff_id text not null,
  device_id text,
  title text not null,
  description text not null default '',
  status text not null default 'open'
    check (status in ('open','in_progress','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  property_id text,
  customer_id text,
  due_at timestamptz,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  completed_at timestamptz
);
create index if not exists staff_mobile_tasks_staff_idx on staff_mobile_tasks (staff_id, status, due_at desc);
create index if not exists staff_mobile_tasks_device_idx on staff_mobile_tasks (device_id, status, due_at desc);

create table if not exists staff_mobile_crm_contacts (
  id text primary key,
  staff_id text not null,
  name text not null,
  phone text not null default '',
  type text not null default 'customer'
    check (type in ('owner','buyer','tenant','builder','partner','customer','other')),
  notes text not null default '',
  property_id text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create index if not exists staff_mobile_crm_contacts_staff_idx on staff_mobile_crm_contacts (staff_id, next_follow_up_at asc nulls last, updated_at desc);
create index if not exists staff_mobile_crm_contacts_phone_idx on staff_mobile_crm_contacts (phone);

create table if not exists staff_mobile_crm_interactions (
  id text primary key,
  contact_id text not null,
  staff_id text not null,
  kind text not null default 'note'
    check (kind in ('call','meeting','note','message','calendar')),
  note text not null default '',
  created_at timestamptz not null default current_timestamp
);
create index if not exists staff_mobile_crm_interactions_contact_idx on staff_mobile_crm_interactions (contact_id, created_at desc);

create table if not exists staff_mobile_visits (
  id text primary key,
  staff_id text not null,
  device_id text,
  property_id text,
  title text not null,
  address text not null default '',
  target_lat numeric(9,6),
  target_lng numeric(9,6),
  radius_m numeric(10,2) not null default 120,
  scheduled_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned','arrived','completed','cancelled')),
  arrived_at timestamptz,
  left_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create index if not exists staff_mobile_visits_staff_idx on staff_mobile_visits (staff_id, status, scheduled_at asc nulls last);
create index if not exists staff_mobile_visits_device_idx on staff_mobile_visits (device_id, status, scheduled_at asc nulls last);

create table if not exists staff_mobile_attendance (
  id text primary key,
  staff_id text not null,
  device_id text not null,
  work_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  start_lat numeric(9,6),
  start_lng numeric(9,6),
  end_lat numeric(9,6),
  end_lng numeric(9,6),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index if not exists staff_mobile_attendance_device_date_uidx on staff_mobile_attendance (device_id, work_date);
create index if not exists staff_mobile_attendance_staff_date_idx on staff_mobile_attendance (staff_id, work_date desc);

create table if not exists staff_mobile_property_captures (
  id text primary key,
  staff_id text not null,
  device_id text not null,
  property_id text,
  visit_id text,
  file_id text not null,
  category text not null default 'general',
  caption text not null default '',
  created_at timestamptz not null default current_timestamp
);
create index if not exists staff_mobile_property_captures_staff_idx on staff_mobile_property_captures (staff_id, created_at desc);
create index if not exists staff_mobile_property_captures_property_idx on staff_mobile_property_captures (property_id, created_at desc);

create table if not exists staff_mobile_health (
  id text primary key,
  device_id text not null unique,
  staff_id text not null,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  received_at timestamptz not null default current_timestamp
);
create index if not exists staff_mobile_health_staff_idx on staff_mobile_health (staff_id, observed_at desc);

alter table staff_mobile_devices
  add column if not exists lost_mode boolean not null default false,
  add column if not exists lost_message text not null default '';

create index if not exists staff_mobile_devices_lost_idx on staff_mobile_devices (lost_mode, updated_at desc);
