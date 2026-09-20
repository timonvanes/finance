-- Name of the person a link was made for, so a payment can be attributed
-- when several people share the same reference code and amount.
alter table bunq_payment_links add column person_name text;
