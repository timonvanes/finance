-- Lets a pot start from a known balance as of a given date, instead of
-- purely being the sum of tracked entries — otherwise a pot that already
-- held money before you started tracking it (or before a herkenningstekst
-- was set and back-matched) would show a wrong, too-low balance.
alter table pots add column opening_balance numeric(12, 2) not null default 0;
alter table pots add column opening_balance_date date not null default current_date;
