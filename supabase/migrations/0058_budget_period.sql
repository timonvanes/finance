-- A budget can run per month (default), per calendar quarter or per calendar
-- year. monthly_limit keeps its name and holds the limit for that period.
alter table budgets
  add column period text not null default 'month'
    check (period in ('month', 'quarter', 'year'));
