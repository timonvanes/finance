-- Cache each linked account's balance (refreshed during sync) so the
-- dashboard can show it without an extra live API call per page view.
alter table bank_accounts add column current_balance numeric(12, 2);
alter table bank_accounts add column balance_updated_at timestamptz;

-- Pot savings goals: a target date alongside the existing target_amount,
-- so the app can tell you how much to deposit per month to get there.
alter table pots add column target_date date;
