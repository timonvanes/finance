-- Let the user override how far back a connection's transaction sync
-- reaches, instead of the hardcoded 90-day default (some banks/consents
-- support a different history window, or a connection may need a manual
-- nudge after being fixed up).
alter table bank_connections add column sync_from_date date;
