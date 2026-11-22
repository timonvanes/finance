-- Undoes 0083_pot_in_house_plan.sql.
alter table pots drop column if exists in_house_plan;
