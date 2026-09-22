-- The expense booked when the WBW balance check finds others fronted money
-- for the user: no bank transaction backs it, no known category or exact date
-- (it is attributed to the period it was detected in).
create table wbw_fronted_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  period_start date not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table wbw_fronted_expenses enable row level security;

create policy "Users manage their own wbw fronted expenses"
  on wbw_fronted_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
