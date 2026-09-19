-- A lender doesn't have to be one of the saved people: allow a free-text name
-- instead of person_id.
alter table loans alter column person_id drop not null;
alter table loans add column lender_name text;
alter table loans add constraint loans_has_lender check (person_id is not null or lender_name is not null);
