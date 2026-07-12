-- Marks a transaction as "still needs to be split into reclaim(s)" so it
-- can be flagged from the transactions list and picked up later on the
-- Terugvorderingen page, instead of having to find it in a dropdown there.
alter table transactions add column flagged_for_reclaim boolean not null default false;

create index transactions_flagged_for_reclaim_idx
  on transactions (user_id, flagged_for_reclaim)
  where flagged_for_reclaim;
