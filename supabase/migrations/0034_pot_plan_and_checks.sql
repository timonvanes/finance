-- Savings pots v2: a planned monthly deposit per pot, and recorded balance
-- checks (you enter the real balance shown at the bank and the app compares
-- it with what it thinks the pot holds).
alter table pots add column monthly_amount numeric(12, 2) check (monthly_amount is null or monthly_amount > 0);

create table pot_balance_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  pot_id uuid not null references pots(id) on delete cascade,
  actual numeric(12, 2) not null,
  expected numeric(12, 2) not null,
  corrected boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table pot_balance_checks enable row level security;

create policy "Users manage their own pot balance checks"
  on pot_balance_checks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index pot_balance_checks_pot_idx on pot_balance_checks (pot_id, checked_at desc);
