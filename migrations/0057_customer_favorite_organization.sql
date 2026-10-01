-- Customer favorite organization: folders, private notes and priority.
alter table customer_favorites
  add column if not exists category text not null default 'عمومی',
  add column if not exists private_note text not null default '',
  add column if not exists priority smallint not null default 0;

alter table customer_favorites
  drop constraint if exists customer_favorites_priority_check;

alter table customer_favorites
  add constraint customer_favorites_priority_check check (priority between 0 and 3);

create index if not exists customer_favorites_owner_category_idx
  on customer_favorites (user_id, category, priority desc, updated_at desc)
  where user_id is not null;

create index if not exists customer_favorites_visitor_category_idx
  on customer_favorites (visitor_id, category, priority desc, updated_at desc)
  where visitor_id is not null;
