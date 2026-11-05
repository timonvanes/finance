-- The day a pot's savings plan begins (null = the day the pot was created). The
-- plan, the pace and the amount asked per period are measured from here: with the
-- first deposit day on or after it as the first installment, and what the pot held
-- before that day as its starting amount.
alter table pots add column schedule_start date;
