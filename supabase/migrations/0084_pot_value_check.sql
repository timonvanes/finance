-- How often the value of a pot has to be updated by hand (shares at a broker cannot be read
-- automatically): every 3, 6 or 12 months. Null = no reminder.
alter table pots add column value_check_months int check (value_check_months in (3, 6, 12));
