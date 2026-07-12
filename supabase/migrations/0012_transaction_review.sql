-- Every expense should be explicitly triaged: either "eigen uitgave" (own
-- spending, nothing to reclaim) or flagged for reclaim. This tracks which
-- ones still need that decision, so the transactions page can show a
-- to-do list of unreviewed ones.
alter table transactions add column reviewed boolean not null default false;

create index transactions_reviewed_idx
  on transactions (user_id, reviewed)
  where not reviewed;
