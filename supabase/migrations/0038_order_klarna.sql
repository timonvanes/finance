-- Orders paid through Klarna: Klarna credits a return against what you still
-- owe (or pays it out), which often never shows up as a bank transaction.
-- credited_amount records what Klarna says it credited/refunded so it can be
-- compared with what the return should have brought in.
alter table orders add column payment_method text not null default 'direct'
  check (payment_method in ('direct', 'klarna'));
alter table orders add column credited_amount numeric(12, 2);
