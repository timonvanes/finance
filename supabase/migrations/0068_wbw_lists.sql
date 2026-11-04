-- Which WieBetaaltWat lists count towards the saldo. New lists count by default,
-- so what is stored is the lists left out. The last fetched lists (name, currency,
-- saldo) are kept so the choice can be changed without logging in again.
alter table user_settings add column wbw_excluded_lists text[] not null default '{}';
alter table user_settings add column wbw_lists jsonb;
