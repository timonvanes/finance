-- The returns module (orders, return deadlines, receipt scanning, forwarded mails) can
-- be switched off per user. On by default, so nothing changes for existing users.
alter table user_settings add column returns_enabled boolean not null default true;
