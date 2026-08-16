-- The total amount actually entered into WBW/Splitwise, kept alongside each
-- reclaim's own computed_amount (its share). WBW/Splitwise does the actual
-- per-person division externally — this just lets the original total stay
-- visible later on the reclaim(s) it was split from, not only at the moment
-- of creating them.
alter table reclaims add column source_total_amount numeric(12, 2);
