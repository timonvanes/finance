-- The return term runs from delivery, not from ordering. Keep the delivery
-- facts (delivered date, expected date from the shop) and the term length
-- separately so the deadline can be recomputed when better data arrives.
alter table orders
  add column delivered_date date,
  add column expected_delivery_date date,
  add column return_window_days int;

alter table orders drop constraint if exists orders_return_deadline_source_check;
alter table orders add constraint orders_return_deadline_source_check
  check (return_deadline_source in ('mail', 'lookup', 'manual', 'estimate'));
