-- Link newly created website leads to the same anonymous visitor that owns
-- favorites, saved searches, and property-watch alerts.
alter table if exists leads
  add column if not exists visitor_id text;

create index if not exists leads_visitor_created_idx
  on leads (visitor_id, created_at desc)
  where visitor_id is not null;
