-- bunq payment links: a bunq.me tab is created per reclaim / combined request,
-- the payer pays it via iDEAL, and the app then sweeps exactly that amount to
-- the fixed payout IBAN (configured in env, not in the database).
create table bunq_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  private_key text not null,
  public_key text not null,
  installation_token text not null,
  session_token text,
  bunq_user_id bigint,
  monetary_account_id bigint,
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: only the service-role client can read this.
alter table bunq_credentials enable row level security;

create table bunq_payment_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  reclaim_id uuid references reclaims(id) on delete cascade,
  payment_request_id uuid references payment_requests(id) on delete cascade,
  tab_id bigint not null,
  share_url text not null,
  amount numeric(12, 2) not null check (amount > 0),
  reference_code text,
  status text not null default 'open'
    check (status in ('open', 'paid', 'sweeping', 'swept')),
  incoming_payment_id bigint,
  error text,
  created_at timestamptz not null default now(),
  swept_at timestamptz
);

alter table bunq_payment_links enable row level security;

create policy "Users read their own bunq links"
  on bunq_payment_links for select
  using (auth.uid() = user_id);

create unique index bunq_links_incoming_payment_idx
  on bunq_payment_links (incoming_payment_id)
  where incoming_payment_id is not null;
create index bunq_links_reclaim_idx on bunq_payment_links (reclaim_id);
create index bunq_links_request_idx on bunq_payment_links (payment_request_id);
