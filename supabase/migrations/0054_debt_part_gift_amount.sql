-- The prestatiebeurs (becomes a gift) inside a specific part, as of the part's
-- balance date. More exact than one adjustment spread over several parts.
alter table debt_parts add column gift_amount numeric(12, 2) not null default 0;
