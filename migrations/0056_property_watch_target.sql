-- Optional target price for property watch subscriptions.
alter table property_watch_subscriptions
  add column if not exists target_price numeric(20,0);

create index if not exists property_watch_subscriptions_target_idx
  on property_watch_subscriptions (target_price)
  where enabled=true and target_price is not null;
