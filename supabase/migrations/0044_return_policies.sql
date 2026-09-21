-- Return windows looked up on the web, once per shop. A null window is cached
-- too (looked up, nothing reliable found) so the same shop isn't searched again.
create table merchant_return_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  merchant_key text not null,
  merchant_name text not null,
  window_days integer,
  source_url text,
  looked_up_at timestamptz not null default now()
);

alter table merchant_return_policies enable row level security;

create policy "Users manage their own return policies"
  on merchant_return_policies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index merchant_return_policies_key_idx on merchant_return_policies (user_id, merchant_key);

-- Where an order's return deadline came from: the mail, a web lookup, or by hand.
alter table orders add column return_deadline_source text
  check (return_deadline_source in ('mail', 'lookup', 'manual'));
