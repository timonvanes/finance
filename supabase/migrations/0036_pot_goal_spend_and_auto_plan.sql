-- goal_spend: for a withdrawal from a pot, whether the money was actually spent
-- on the goal (e.g. the flights for the holiday). null = not answered yet.
-- Spending on the goal lowers the pot's target by the same amount.
alter table pot_entries add column goal_spend text check (goal_spend in ('yes', 'no'));

-- monthly_auto: the monthly plan is calculated from target amount and date
-- instead of being a fixed number.
alter table pots add column monthly_auto boolean not null default false;
