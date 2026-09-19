-- Loans: money that was deposited to you but was really a loan from someone.
-- Each loan belongs to a person; borrow entries (incoming transactions) add
-- to it, repay entries (outgoing transactions or manual amounts) reduce it.
-- A loan is closed when repaid, or when it's been forgiven ("hoeft niet meer
-- af te lossen").
create table loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  person_id uuid not null references people(id) on delete restrict,
  note text,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_reason text check (closed_reason in ('repaid', 'forgiven')),
  created_at timestamptz not null default now()
);

alter table loans enable row level security;

create policy "Users manage their own loans"
  on loans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table loan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  loan_id uuid not null references loans(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  kind text not null check (kind in ('borrow', 'repay')),
  amount numeric(12, 2) not null check (amount > 0),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table loan_entries enable row level security;

create policy "Users manage their own loan entries"
  on loan_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index loan_entries_transaction_idx
  on loan_entries (transaction_id)
  where transaction_id is not null;
create index loan_entries_loan_idx on loan_entries (loan_id);
