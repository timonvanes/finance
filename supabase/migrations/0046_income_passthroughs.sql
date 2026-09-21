-- Part of an incoming payment (e.g. huurtoeslag) that is not yours but meant for
-- housemates. It is left out of your income; when you pay it on, that outgoing
-- transfer is linked here and left out of your spending too.
create table income_passthroughs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  source_transaction_id uuid not null references transactions(id) on delete cascade,
  person_id uuid not null references people(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payout_transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table income_passthroughs enable row level security;

create policy "Users manage their own income passthroughs"
  on income_passthroughs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index income_passthroughs_source_idx on income_passthroughs (source_transaction_id);
