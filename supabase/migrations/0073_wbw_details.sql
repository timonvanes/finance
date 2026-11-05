-- Who was charged in a WieBetaaltWat expense, and for how much: kept with the
-- imported transaction (which itself holds only your part) so it can be shown when
-- you open it. { list, payer, total, shares: [{ name, amount, you }] }
alter table transactions add column wbw_details jsonb;

-- transactions gained a column: the view has to be re-created (see 0025/0028/0049/0070).
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
