-- A WBW "fronted for you" expense is booked in the period the money was
-- actually fronted (the stretch between two balance entries), which is not
-- always the period the balance was entered in. This ties each expense to the
-- balance entry it came from, so saving that entry again replaces it.
alter table wbw_fronted_expenses add column balance_period_start date;
update wbw_fronted_expenses set balance_period_start = period_start where balance_period_start is null;
