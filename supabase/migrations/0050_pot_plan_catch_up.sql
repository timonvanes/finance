-- Fixed monthly plans keep a running score: what should have gone in since the
-- plan started versus what did. A missed period is either carried over to the
-- next one or skipped, by the user's choice.
alter table pots add column plan_start_date date;
update pots set plan_start_date = created_at::date where monthly_amount is not null;

create table pot_period_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  pot_id uuid not null references pots(id) on delete cascade,
  period_start date not null,
  decision text not null check (decision in ('carry', 'skip')),
  created_at timestamptz not null default now(),
  unique (pot_id, period_start)
);

alter table pot_period_decisions enable row level security;

create policy "Users manage their own pot period decisions"
  on pot_period_decisions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
