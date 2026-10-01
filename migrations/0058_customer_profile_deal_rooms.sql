-- Customer needs profile and shared deal rooms.
create table if not exists customer_need_profiles (
  visitor_id text primary key,
  user_id text,
  transaction_type text not null default '',
  property_type text not null default '',
  neighborhoods jsonb not null default '[]'::jsonb,
  min_price numeric(20,0),
  max_price numeric(20,0),
  min_area numeric(10,2),
  max_area numeric(10,2),
  bedrooms smallint,
  requested_amenities jsonb not null default '[]'::jsonb,
  must_have_amenities jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default current_timestamp
);
create index if not exists customer_need_profiles_user_idx on customer_need_profiles(user_id, updated_at desc) where user_id is not null;

create table if not exists customer_deal_rooms (
  id text primary key,
  visitor_id text,
  user_id text,
  name text not null default 'اتاق معامله من',
  status text not null default 'open' check (status in ('open','closed')),
  share_token text unique,
  notes text not null default '',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create index if not exists customer_deal_rooms_user_idx on customer_deal_rooms(user_id, updated_at desc) where user_id is not null;
create index if not exists customer_deal_rooms_visitor_idx on customer_deal_rooms(visitor_id, updated_at desc) where visitor_id is not null;

create table if not exists customer_deal_room_items (
  room_id text not null references customer_deal_rooms(id) on delete cascade,
  property_slug text not null,
  private_note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default current_timestamp,
  primary key(room_id, property_slug)
);
create index if not exists customer_deal_room_items_room_idx on customer_deal_room_items(room_id, sort_order, created_at);

create table if not exists customer_deal_room_documents (
  id bigserial primary key,
  room_id text not null references customer_deal_rooms(id) on delete cascade,
  title text not null,
  url text not null,
  kind text not null default 'link',
  note text not null default '',
  created_at timestamptz not null default current_timestamp
);
create index if not exists customer_deal_room_documents_room_idx on customer_deal_room_documents(room_id, created_at desc);