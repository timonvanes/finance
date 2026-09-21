-- The house planner: the user's own inputs and assumptions, one row per user.
create table house_plans (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  target_date date not null,
  target_price numeric(12, 2) not null,
  income_gross_year numeric(12, 2),
  partner_income_gross_year numeric(12, 2),
  rate numeric(5, 2) not null default 4.0,
  term_years int not null default 30,
  cost_pct numeric(5, 2) not null default 4.0,
  housing_pct numeric(5, 2) not null default 28.0,
  student_monthly numeric(12, 2),
  start_savings numeric(12, 2) not null default 0,
  start_invest numeric(12, 2) not null default 0,
  monthly_save numeric(12, 2) not null default 0,
  monthly_invest numeric(12, 2) not null default 0,
  savings_rate numeric(5, 2) not null default 2.0,
  return_low numeric(5, 2) not null default 1.0,
  return_mid numeric(5, 2) not null default 5.0,
  return_high numeric(5, 2) not null default 8.0,
  updated_at timestamptz not null default now()
);

alter table house_plans enable row level security;

create policy "Users manage their own house plan"
  on house_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
