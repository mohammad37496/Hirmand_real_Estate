-- Phone Bridge binary files explicitly selected by the device owner.
-- Files are deduplicated per device by SHA-256 and never exposed through public APIs.

create table if not exists phone_bridge_files (
  id text primary key,
  device_id text not null references phone_bridge_devices(id) on delete cascade,
  name text not null default 'file',
  mime_type text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  sha256 text not null,
  uploaded_at timestamptz not null default current_timestamp,
  content bytea not null
);

create unique index if not exists phone_bridge_files_device_hash_uq
  on phone_bridge_files(device_id, sha256);

create index if not exists phone_bridge_files_device_uploaded_idx
  on phone_bridge_files(device_id, uploaded_at desc);
