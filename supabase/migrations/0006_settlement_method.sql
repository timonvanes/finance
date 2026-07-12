-- How a reclaim is expected to come back: a regular bank transfer/Tikkie
-- (which we can auto-match against synced transactions) or an external app
-- like WieBetaaltWat/Splitwise that settles balances differently and can't
-- be matched to a single incoming transaction.
alter table reclaims
  add column settlement_method text not null default 'bank'
    check (settlement_method in ('bank', 'external_app'));
