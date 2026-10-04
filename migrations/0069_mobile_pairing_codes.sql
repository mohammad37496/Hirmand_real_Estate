-- Admin-controlled, short-lived, single-use device pairing codes.
create table if not exists mobile_pairing_codes (
  id text primary key,
  code_hash text not null unique,
  created_by text not null default 'مدیر',
  created_at timestamptz not null default current_timestamp,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_device_id text references mobile_devices(id) on delete set null
);

create index if not exists mobile_pairing_codes_active_idx
  on mobile_pairing_codes (expires_at desc)
  where used_at is null;
