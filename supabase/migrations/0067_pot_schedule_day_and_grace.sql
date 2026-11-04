-- Savings schedule of a pot: the day of the month the monthly deposit is due.
-- null = the start of the user's month (their budget start day).
alter table pots add column schedule_day smallint check (schedule_day between 1 and 28);

-- Slack, in days before and after the deposit day, in which depositing or not
-- both count as "on schedule".
alter table user_settings add column pot_grace_days smallint not null default 3 check (pot_grace_days between 0 and 14);
