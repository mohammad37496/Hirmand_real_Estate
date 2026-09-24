-- Atomic anti-abuse gates for public endpoints.
-- Keys are intentionally coarse (endpoint + client key) so limits work across
-- horizontally scaled Vercel instances without relying on process memory.

create table if not exists lead_dedupe_guard (
  phone text primary key,
  request_token text not null,
  last_submitted_at timestamptz not null default current_timestamp
);

create index if not exists lead_dedupe_guard_last_submitted_idx
  on lead_dedupe_guard (last_submitted_at desc);

create table if not exists api_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null default current_timestamp,
  request_count integer not null default 0
);

create index if not exists api_rate_limit_buckets_window_idx
  on api_rate_limit_buckets (window_started_at desc);
