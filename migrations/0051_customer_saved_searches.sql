-- Persist browser saved searches so Hirmand can alert customers about
-- newly published matching files and genuine price reductions.
create table if not exists customer_saved_searches (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  client_id text not null,
  name text not null,
  params text not null,
  enabled boolean not null default true,
  last_checked_at timestamptz not null default current_timestamp,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  unique (visitor_id, client_id)
);

create index if not exists customer_saved_searches_visitor_idx
  on customer_saved_searches (visitor_id, enabled, updated_at desc);

create table if not exists customer_saved_search_alerts (
  id bigserial primary key,
  saved_search_id uuid not null references customer_saved_searches(id) on delete cascade,
  visitor_id text not null,
  property_id text not null,
  property_slug text not null,
  alert_type text not null check (alert_type in ('new_match','price_drop')),
  event_key text not null unique,
  title text not null,
  message text not null,
  created_at timestamptz not null default current_timestamp,
  seen_at timestamptz
);

create index if not exists customer_saved_search_alerts_visitor_idx
  on customer_saved_search_alerts (visitor_id, seen_at, created_at desc);

create index if not exists customer_saved_search_alerts_search_idx
  on customer_saved_search_alerts (saved_search_id, created_at desc);

delete from customer_saved_search_alerts
where created_at < current_timestamp - interval '120 days';
