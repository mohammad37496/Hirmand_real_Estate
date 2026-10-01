-- Customer engagement: private conversations, callback requests, and Web Push subscriptions.
create table if not exists customer_conversations (
  id text primary key,
  visitor_id text,
  user_id text,
  lead_id text,
  property_id text,
  property_title text not null default '',
  consultant_name text not null default '',
  status text not null default 'open'
    check (status in ('open','waiting_customer','waiting_consultant','closed')),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  last_message_at timestamptz
);

create index if not exists customer_conversations_user_idx
  on customer_conversations (user_id, updated_at desc)
  where user_id is not null;

create index if not exists customer_conversations_visitor_idx
  on customer_conversations (visitor_id, updated_at desc)
  where visitor_id is not null;

create index if not exists customer_conversations_status_idx
  on customer_conversations (status, last_message_at desc);

create table if not exists customer_messages (
  id bigserial primary key,
  conversation_id text not null references customer_conversations(id) on delete cascade,
  sender_type text not null
    check (sender_type in ('customer','consultant','admin')),
  sender_id text not null default '',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default current_timestamp
);

create index if not exists customer_messages_conversation_idx
  on customer_messages (conversation_id, created_at asc, id asc);

create index if not exists customer_messages_unread_idx
  on customer_messages (conversation_id, read_at)
  where read_at is null;

create table if not exists callback_requests (
  id text primary key,
  visitor_id text,
  user_id text,
  name text not null,
  phone text not null,
  preferred_at timestamptz,
  property_id text,
  property_title text not null default '',
  note text not null default '',
  status text not null default 'new'
    check (status in ('new','contacted','scheduled','completed','cancelled')),
  internal_note text not null default '',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  handled_at timestamptz
);

create index if not exists callback_requests_user_idx
  on callback_requests (user_id, created_at desc)
  where user_id is not null;

create index if not exists callback_requests_visitor_idx
  on callback_requests (visitor_id, created_at desc)
  where visitor_id is not null;

create index if not exists callback_requests_queue_idx
  on callback_requests (status, preferred_at asc nulls last, created_at desc);

create table if not exists customer_push_subscriptions (
  endpoint text primary key,
  visitor_id text,
  user_id text,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create index if not exists customer_push_subscriptions_user_idx
  on customer_push_subscriptions (user_id, updated_at desc)
  where user_id is not null;

create index if not exists customer_push_subscriptions_visitor_idx
  on customer_push_subscriptions (visitor_id, updated_at desc)
  where visitor_id is not null;
