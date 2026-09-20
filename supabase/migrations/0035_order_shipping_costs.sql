-- Return shipping/fees: a refund isn't always just the returned items. The
-- original shipping cost may come back too, and a return fee may be held back.
alter table orders add column refunded_shipping numeric(12, 2) not null default 0;
alter table orders add column return_fee numeric(12, 2) not null default 0;
