-- Read-model for transactions that respects a connection's "Historie
-- vanaf" (sync_from_date): rows booked before that date are hidden from
-- every listing/analysis, but stay in the database untouched — clearing
-- the date makes them reappear. security_invoker makes the base table's
-- RLS apply to whoever queries the view.
create view visible_transactions
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
