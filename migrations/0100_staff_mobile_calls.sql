-- First-party Hirmand staff call history and call recordings.
-- This storage is intentionally independent from all legacy Phone Bridge tables.
-- Call recording is available only when the employee has accepted the Hirmand
-- employee agreement and explicitly enabled recording in the Hirmand staff app.

create table if not exists staff_mobile_files (
  id text primary key,
  device_id text not null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  content bytea not null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists staff_mobile_files_device_time_idx
  on staff_mobile_files (device_id, created_at desc);

create unique index if not exists staff_mobile_files_device_sha_uidx
  on staff_mobile_files (device_id, sha256);

create table if not exists staff_mobile_calls (
  id text primary key,
  device_id text not null,
  staff_id text not null,
  source_call_id text not null,
  phone_number text,
  contact_name text,
  direction text not null
    check (direction in ('incoming','outgoing','missed','rejected','blocked','other')),
  occurred_at timestamptz not null,
  duration_seconds integer not null default 0,
  received_at timestamptz not null default current_timestamp
);

create unique index if not exists staff_mobile_calls_device_source_uidx
  on staff_mobile_calls (device_id, source_call_id);

create index if not exists staff_mobile_calls_staff_time_idx
  on staff_mobile_calls (staff_id, occurred_at desc);

create index if not exists staff_mobile_calls_device_time_idx
  on staff_mobile_calls (device_id, occurred_at desc);

create table if not exists staff_mobile_call_recordings (
  id text primary key,
  device_id text not null,
  staff_id text not null,
  call_id text,
  file_id text not null,
  source_call_id text,
  call_started_at timestamptz not null,
  call_ended_at timestamptz,
  direction text not null
    check (direction in ('incoming','outgoing','unknown')),
  phone_number text,
  contact_name text,
  duration_seconds integer,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists staff_mobile_call_recordings_device_time_idx
  on staff_mobile_call_recordings (device_id, call_started_at desc);

create index if not exists staff_mobile_call_recordings_staff_time_idx
  on staff_mobile_call_recordings (staff_id, call_started_at desc);

create unique index if not exists staff_mobile_call_recordings_device_sha_uidx
  on staff_mobile_call_recordings (device_id, sha256);

alter table staff_mobile_devices
  add column if not exists call_recording_enabled boolean not null default false;

