-- How much of a withdrawal was spent on the goal, when that's only part of it
-- (e.g. €900 out of the pot for flights for several people, of which €450 is
-- your own share). null with goal_spend = 'yes' means the whole amount.
alter table pot_entries add column goal_spend_amount numeric(12, 2) check (goal_spend_amount is null or goal_spend_amount >= 0);
