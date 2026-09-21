-- Debts with several parts (DUO study loan now, a mortgage later). Each part has
-- its own balance, interest rate and the date its rate stays fixed until.
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  kind text not null default 'duo' check (kind in ('duo', 'mortgage', 'other')),
  name text not null,
  regime text,
  -- First day of the repayment phase (after the aanloopfase for a study loan).
  repay_start date,
  term_years int not null default 35,
  -- The monthly amount the lender determined; empty = use the estimate.
  monthly_payment numeric(12, 2),
  -- Part of the balances (already counted in them) that becomes a gift
  -- (prestatiebeurs), so it is not repaid.
  gift_adjustment numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table debts enable row level security;

create policy "Users manage their own debts"
  on debts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table debt_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  debt_id uuid not null references debts(id) on delete cascade,
  name text not null,
  balance numeric(12, 2) not null,
  balance_date date not null,
  rate numeric(6, 3) not null,
  rate_fixed_until date,
  is_gift boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table debt_parts enable row level security;

create policy "Users manage their own debt parts"
  on debt_parts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index debt_parts_debt_idx on debt_parts (debt_id);
