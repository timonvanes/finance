-- The financial plan holds several scenarios (for example buying alone or together),
-- each with a stress, basis and favourable variant, plus where every assumption comes
-- from, when it was checked and what it used to be. One document per user.
alter table house_plans add column doc jsonb;
