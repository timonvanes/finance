-- The financial plan (house, income, tax, study loan, saving and investing) keeps
-- its many extra settings and the yearly check-ins together in one document, next
-- to the basic columns the house planner already had.
alter table house_plans add column extra jsonb;
