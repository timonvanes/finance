-- The bank only gives a booking date, so transactions from the same day have no
-- order. Card and transfer descriptions usually carry the time ("21-09-2026
-- 13:15"); keep it to sort same-day transactions correctly.
alter table transactions add column booked_at timestamptz;

update transactions t
set booked_at = (
  to_timestamp(m[1] || ' ' || m[2], 'DD-MM-YYYY HH24:MI')::timestamp
) at time zone 'Europe/Amsterdam'
from (
  select id, regexp_match(raw_description, '(\d{2}-\d{2}-\d{4}) (\d{2}:\d{2})') as m
  from transactions
  where raw_description is not null
) s
where t.id = s.id
  and s.m is not null
  and to_date(s.m[1], 'DD-MM-YYYY') = t.booking_date;

-- transactions gained a column: the view has to be re-created (see 0025/0028).
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
