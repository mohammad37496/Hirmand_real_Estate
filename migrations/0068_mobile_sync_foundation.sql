-- Internal mobile sync foundation: device enrollment and durable event ingestion.
create table if not exists mobile_devices (
  id text primary key,
  platform text not null default 'android'
    check (platform in ('android','ios','web')),
  app_version text not null default '',
  device_model text not null default '',
  os_version text not null default '',
  device_label text not null default '',
  access_token_hash text not null unique,
  enabled boolean not null default true,
  first_seen_at timestamptz not null default current_timestamp,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists mobile_devices_last_seen_idx
  on mobile_devices (last_seen_at desc);

create index if not exists mobile_devices_enabled_idx
  on mobile_devices (enabled, last_seen_at desc);

create table if not exists mobile_telemetry_events (
  id bigserial primary key,
  device_id text not null references mobile_devices(id) on delete cascade,
  client_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default current_timestamp,
  payload jsonb not null default '{}'::jsonb,
  unique (device_id, client_event_id)
);

create index if not exists mobile_telemetry_events_device_time_idx
  on mobile_telemetry_events (device_id, occurred_at desc);

create index if not exists mobile_telemetry_events_type_time_idx
  on mobile_telemetry_events (event_type, occurred_at desc);
