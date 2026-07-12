-- Store IBANs so we can recognize a transaction as a transfer between the
-- user's own accounts (e.g. ING -> Rabobank) rather than real spend/income.
alter table bank_accounts add column iban text;
alter table transactions add column counterparty_iban text;

create index transactions_counterparty_iban_idx on transactions (user_id, counterparty_iban);
