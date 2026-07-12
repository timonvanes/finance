-- Money owed back by someone else for (a share of) a transaction.
create table reclaims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  person_name text not null,
  amount_type text not null check (amount_type in ('fraction', 'fixed')),
  amount_value numeric(12, 4) not null,
  computed_amount numeric(12, 2) not null,
  tikkie_link text,
  status text not null default 'requested' check (status in ('requested', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reclaims enable row level security;

create policy "Users manage their own reclaims"
  on reclaims for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index reclaims_transaction_id_idx on reclaims (transaction_id);
create index reclaims_status_idx on reclaims (status);
