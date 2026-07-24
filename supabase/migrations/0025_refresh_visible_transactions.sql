-- A view defined as "select t.*" freezes its column list at creation time —
-- it does NOT automatically pick up columns added to the base table
-- afterward (here: transactions.note, added in 0024). Re-create with the
-- identical definition so Postgres re-evaluates t.* and includes it.
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
