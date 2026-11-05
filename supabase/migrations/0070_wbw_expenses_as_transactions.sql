-- WieBetaaltWat expenses as transactions: your part of what others paid, in the
-- same table as the bank transactions, so they show up in the list, can be
-- categorised and count in the budgets and reports like any other.

-- A WieBetaaltWat expense has no bank account.
alter table transactions alter column bank_account_id drop not null;
alter table transactions add column source text not null default 'bank' check (source in ('bank', 'wbw'));
alter table transactions add column wbw_expense_id text;
-- The category WieBetaaltWat gave it, to map to one of your own categories.
alter table transactions add column wbw_category text;

-- One transaction per WieBetaaltWat expense.
create unique index transactions_wbw_expense_unique
  on transactions (user_id, wbw_expense_id)
  where wbw_expense_id is not null;

-- transactions gained columns: the view has to be re-created (see 0025/0028/0049).
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

-- Importing is off until this is set: the first day expenses are taken in from.
-- From that period on the saldo-based estimate of "Via WieBetaaltWat" stops, as the
-- real expenses replace it.
alter table user_settings add column wbw_import_from date;

-- Which of your categories a WieBetaaltWat category (like "Huishoudelijke
-- uitgaven") becomes. Chosen once; new expenses follow it.
create table wbw_category_map (
  user_id uuid not null references auth.users(id) default auth.uid(),
  wbw_category text not null,
  category_id uuid references categories(id) on delete set null,
  primary key (user_id, wbw_category)
);

alter table wbw_category_map enable row level security;

create policy "Users manage their own wbw category map"
  on wbw_category_map for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
