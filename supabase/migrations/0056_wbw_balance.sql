-- Monthly WieBetaaltWat balance (net across all groups): what the user filled
-- in from the app. The gap between the expected balance (last month's + what
-- was fronted for others this month) and this value becomes what others
-- fronted for the user — an expense with no known category or date.
create table wbw_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  period_start date not null,
  balance numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, period_start)
);

alter table wbw_balances enable row level security;

create policy "Users manage their own wbw balances"
  on wbw_balances for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
