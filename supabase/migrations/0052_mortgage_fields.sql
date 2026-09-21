-- Mortgage parts repay in different ways and end on a date; the house has a value.
alter table debt_parts
  add column repay_type text not null default 'annuity'
    check (repay_type in ('annuity', 'linear', 'interest_only')),
  add column end_date date;

alter table debts
  add column property_value numeric(12, 2),
  add column property_value_date date;
