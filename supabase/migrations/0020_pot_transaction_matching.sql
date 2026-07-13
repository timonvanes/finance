-- Rabobank (and similar) sub-accounts/"potjes" are internal — no separate
-- IBAN — so the only way to recognize a transfer into/out of one is the
-- name showing up in the transaction's description. match_text is that
-- name; any synced transaction containing it (case-insensitive) becomes
-- an automatic pot entry instead of a manually typed amount.
alter table pots add column match_text text;

alter table pot_entries add column transaction_id uuid references transactions(id) on delete cascade;

-- A given transaction should only ever create one auto-matched entry,
-- even if sync or the rematch action runs again.
create unique index pot_entries_transaction_id_idx
  on pot_entries (transaction_id)
  where transaction_id is not null;
