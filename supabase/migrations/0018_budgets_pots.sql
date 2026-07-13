-- Monthly budget limits per category ("€500 voor boodschappen deze maand").
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  category_id uuid not null references categories(id) on delete cascade,
  monthly_limit numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

alter table budgets enable row level security;

create policy "Users manage their own budgets"
  on budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Virtual money pots (vakantiepotje, spaardoel, beleggingsdoel). PSD2 only
-- exposes payment accounts — savings/investment accounts aren't linkable —
-- so pots track allocations the user registers here, not a real account.
create table pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  kind text not null default 'savings'
    check (kind in ('savings', 'investment', 'vacation', 'other')),
  target_amount numeric(12, 2),
  created_at timestamptz not null default now()
);

alter table pots enable row level security;

create policy "Users manage their own pots"
  on pots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deposits (positive) and withdrawals (negative) into a pot.
create table pot_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  pot_id uuid not null references pots(id) on delete cascade,
  amount numeric(12, 2) not null,
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table pot_entries enable row level security;

create policy "Users manage their own pot entries"
  on pot_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index pot_entries_pot_id_idx on pot_entries (pot_id);
