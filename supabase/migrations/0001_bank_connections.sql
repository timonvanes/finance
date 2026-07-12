-- Bank connections: one row per completed Enable Banking authorization ("link a bank" action).
create table bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  institution_name text not null,
  institution_country text not null,
  auth_ref text not null unique,
  session_id text,
  consent_status text not null default 'pending'
    check (consent_status in ('pending', 'linked', 'expired', 'revoked')),
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table bank_connections enable row level security;

create policy "Users manage their own bank connections"
  on bank_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Bank accounts: a single authorization/session can grant access to multiple accounts.
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  bank_connection_id uuid not null references bank_connections(id) on delete cascade,
  account_uid text not null unique,
  currency text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table bank_accounts enable row level security;

create policy "Users manage their own bank accounts"
  on bank_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Transactions synced from Enable Banking.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  external_transaction_id text not null,
  booking_date date not null,
  amount numeric(12, 2) not null,
  currency text not null default 'EUR',
  counterparty_name text,
  raw_description text,
  is_transfer boolean not null default false,
  created_at timestamptz not null default now(),
  unique (bank_account_id, external_transaction_id)
);

alter table transactions enable row level security;

create policy "Users manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index transactions_user_booking_date_idx
  on transactions (user_id, booking_date desc);
