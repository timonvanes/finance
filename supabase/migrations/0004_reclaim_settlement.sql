-- Link a reclaim to the actual incoming transaction that paid it back,
-- so we can tell "requested" apart from "money has genuinely arrived".
alter table reclaims
  add column settled_transaction_id uuid references transactions(id) on delete set null;
