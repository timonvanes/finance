-- Orders get a return deadline (the last day to send items back), filled from
-- order/delivery mails that the app receives on a dedicated address.
alter table orders add column return_deadline date;

-- Every mail received on the inbound address, for de-duplication and so an
-- unmatched return mail can be seen instead of silently disappearing.
create table inbound_mails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  message_id text not null,
  subject text,
  sender text,
  kind text,
  outcome text not null,
  body_excerpt text,
  created_at timestamptz not null default now()
);

alter table inbound_mails enable row level security;

create policy "Users read their own inbound mails"
  on inbound_mails for select
  using (auth.uid() = user_id);

create policy "Users delete their own inbound mails"
  on inbound_mails for delete
  using (auth.uid() = user_id);

create unique index inbound_mails_message_idx on inbound_mails (user_id, message_id);
