-- Undoes 0084_pot_value_check.sql.
alter table pots drop column if exists value_check_months;
