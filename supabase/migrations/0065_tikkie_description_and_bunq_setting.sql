-- The description typed for a Tikkie is kept on the (combined) request, like the
-- note on a single reclaim, so it survives leaving the page.
alter table payment_requests add column note text;

-- bunq payment links need a paid bunq plan. Off by default; switching it on
-- brings the "Maak betaalverzoek" button back next to the Tikkie one.
alter table user_settings add column use_bunq_payment_links boolean not null default false;
