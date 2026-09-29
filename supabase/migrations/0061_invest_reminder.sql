-- Day of the month for a "time to buy" investment reminder (1-28, like the
-- month-start day). Null means the reminder is off.
alter table user_settings add column invest_reminder_day int check (invest_reminder_day between 1 and 28);
