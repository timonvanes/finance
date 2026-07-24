-- "Niet inbaar": if a reclaim never gets paid and you decide to stop
-- chasing it, mark it written off instead of leaving it stuck as
-- "openstaand" forever — it drops out of the outstanding totals and won't
-- be offered for auto-matching anymore.
alter table reclaims drop constraint reclaims_status_check;
alter table reclaims add constraint reclaims_status_check
  check (status in ('requested', 'paid', 'written_off'));

alter table payment_requests drop constraint payment_requests_status_check;
alter table payment_requests add constraint payment_requests_status_check
  check (status in ('requested', 'paid', 'written_off'));
