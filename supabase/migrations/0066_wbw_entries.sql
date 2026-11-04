-- WieBetaaltWat entries, replacing "one balance per period":
--  * kind 'balance'    : the WBW saldo on a date (+ = you still get, - = you still owe)
--  * kind 'settlement' : money that went back and forth to square up (recht trekken):
--                        + = you received, - = you paid. It moves the saldo but is no cost.
-- Balances can be filled in on any day, as often as wanted. What others fronted
-- for you is derived from consecutive balances (see src/lib/wbw-balance.ts), so
-- nothing derived is stored.
create table wbw_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  entry_date date not null,
  kind text not null check (kind in ('balance', 'settlement')),
  amount numeric(12, 2) not null,
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index wbw_entries_user_date on wbw_entries (user_id, entry_date);

alter table wbw_entries enable row level security;

create policy "Users manage their own wbw entries"
  on wbw_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Carry the existing monthly balances over, dated on the day they were entered.
insert into wbw_entries (user_id, entry_date, kind, amount, created_at)
select user_id, (created_at at time zone 'Europe/Amsterdam')::date, 'balance', balance, created_at
from wbw_balances;
