-- Paying on a passthrough takes only that amount out of the outgoing payment's
-- spending (an expense contribution), so a payment that also contains your own
-- rent still counts for the rest.
alter table income_passthroughs
  add column payout_contribution_id uuid references expense_contributions(id) on delete set null;
