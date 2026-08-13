-- Tracks when the CURRENT authorization attempt started, separate from
-- created_at (a connection's original creation date). Needed since
-- re-authorizing an expired connection resets consent_status back to
-- "pending" on the same row — without this, the "stuck pending for >15
-- minutes" detection on the settings page kept using the original
-- created_at, so a connection created months ago looked instantly stale
-- the moment a fresh re-auth attempt began.
alter table bank_connections add column auth_started_at timestamptz not null default now();
