-- Which overview modules the user has switched off.
alter table user_settings add column dashboard_hidden text[] not null default '{}';
