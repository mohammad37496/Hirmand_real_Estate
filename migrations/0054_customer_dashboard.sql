-- Attach customer-owned data to a Better Auth account while keeping the
-- anonymous visitor id as a migration bridge and same-browser fallback.
alter table if exists leads
  add column if not exists visitor_id text,
  add column if not exists user_id text;

alter table if exists customer_favorites
  add column if not exists user_id text;

alter table if exists customer_saved_searches
  add column if not exists user_id text;

alter table if exists property_watch_subscriptions
  add column if not exists user_id text;

alter table if exists property_watch_alerts
  add column if not exists user_id text;

create index if not exists leads_user_created_idx
  on leads (user_id, created_at desc)
  where user_id is not null;

create index if not exists customer_favorites_user_idx
  on customer_favorites (user_id, updated_at desc)
  where user_id is not null;

create index if not exists customer_saved_searches_user_idx
  on customer_saved_searches (user_id, updated_at desc)
  where user_id is not null;

create index if not exists property_watch_subscriptions_user_idx
  on property_watch_subscriptions (user_id, enabled, updated_at desc)
  where user_id is not null;

create index if not exists property_watch_alerts_user_idx
  on property_watch_alerts (user_id, seen_at, created_at desc)
  where user_id is not null;
