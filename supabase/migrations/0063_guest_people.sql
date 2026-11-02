-- A guest is someone you reclaim money from once and do not want in your
-- list of people: hidden from the people pickers and settings.
alter table people add column is_guest boolean not null default false;
