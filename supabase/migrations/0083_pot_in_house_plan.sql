-- Which pots count for the house plan. A pot for a holiday, say, should not count towards
-- the deposit, so each pot can be left out. Existing pots keep counting, as before.
alter table pots add column in_house_plan boolean not null default true;
