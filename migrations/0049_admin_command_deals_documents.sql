-- Admin command center, structured deal stages, and private deal documents.
alter table leads
  add column if not exists deal_stage text not null default 'qualification';

alter table leads drop constraint if exists leads_deal_stage_check;
alter table leads
  add constraint leads_deal_stage_check
  check (deal_stage in (
    'qualification',
    'property_selection',
    'viewing',
    'negotiation',
    'contract_preparation',
    'contract_signed',
    'won',
    'lost'
  ));

update leads
set deal_stage = case status
  when 'new' then 'qualification'
  when 'contacted' then 'property_selection'
  when 'follow_up' then 'negotiation'
  when 'visited' then 'viewing'
  when 'contract' then 'contract_preparation'
  when 'closed' then 'lost'
  when 'spam' then 'lost'
  else 'qualification'
end
where coalesce(trim(deal_stage), '') = '' or deal_stage = 'qualification';

create index if not exists leads_deal_stage_updated_idx
  on leads (deal_stage, updated_at desc);

create index if not exists leads_active_queue_idx
  on leads (status, follow_up_at asc, visit_preferred_at asc, created_at desc);

create table if not exists admin_documents (
  id text primary key,
  lead_id text references leads(id) on delete cascade,
  property_id text references properties(id) on delete set null,
  title text not null,
  document_type text not null default 'other'
    check (document_type in ('identity','ownership','property','bank','contract','receipt','other')),
  status text not null default 'pending'
    check (status in ('pending','verified','rejected')),
  file_url text not null,
  media_id text,
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  notes text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  check (lead_id is not null or property_id is not null)
);

create index if not exists admin_documents_lead_created_idx
  on admin_documents (lead_id, created_at desc);

create index if not exists admin_documents_property_created_idx
  on admin_documents (property_id, created_at desc);

create index if not exists admin_documents_status_due_idx
  on admin_documents (status, due_at asc nulls last);
