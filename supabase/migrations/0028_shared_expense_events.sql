-- "Gedeelde uitgaven": a lightweight way to track the true cost of a shared
-- trip/event where costs go both ways (you pay some things, someone else
-- pays others) and settle up with one lump-sum payment at the end — unlike
-- reclaims, this isn't pinned to a single transaction, and unlike a
-- category it's a one-off grouping, not a recurring bucket. The split
-- itself (who owes what) is usually already computed elsewhere (e.g.
-- WieBetaaltWat) — this just records the result and nets it against what
-- you actually paid.
create table shared_expense_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  settlement_amount numeric(12, 2),
  settlement_direction text check (settlement_direction in ('owed_to_me', 'owed_by_me')),
  settlement_transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table shared_expense_events enable row level security;

create policy "Users manage their own shared expense events"
  on shared_expense_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table transactions add column shared_expense_event_id uuid references shared_expense_events(id) on delete set null;
create index transactions_shared_expense_event_idx on transactions (shared_expense_event_id);

-- visible_transactions is "select t.*", which freezes its column list at
-- creation time — every column added to transactions since needs this same
-- refresh, or queries selecting the new column break (hit this exact bug
-- with transactions.note before).
create or replace view visible_transactions
  with (security_invoker = on) as
select t.*
from transactions t
where not exists (
  select 1
  from bank_accounts ba
  join bank_connections bc on bc.id = ba.bank_connection_id
  where ba.id = t.bank_account_id
    and bc.sync_from_date is not null
    and t.booking_date < bc.sync_from_date
);
