create table if not exists customer_favorites (
  visitor_id text not null,
  property_slug text not null,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  primary key (visitor_id, property_slug)
);

create index if not exists customer_favorites_visitor_idx
  on customer_favorites (visitor_id, updated_at desc);

delete from customer_favorites
where updated_at < current_timestamp - interval '365 days';
