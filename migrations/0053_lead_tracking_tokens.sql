alter table if exists leads
  add column if not exists tracking_token text;

update leads
set tracking_token = md5(id::text || created_at::text || random()::text)
where tracking_token is null or trim(tracking_token) = '';

create unique index if not exists leads_tracking_token_uidx
  on leads(tracking_token)
  where tracking_token is not null;

create index if not exists leads_tracking_created_idx
  on leads(created_at desc);
