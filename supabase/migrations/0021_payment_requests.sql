-- Bundles multiple reclaims owed by the same person (from different
-- transactions/occasions) into one combined betaalverzoek: one reference
-- code, one total amount, one incoming payment that settles all of them
-- at once — instead of the person having to pay several small amounts.
create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  person_id uuid not null references people(id) on delete cascade,
  reference_code text not null,
  tikkie_link text,
  status text not null default 'requested' check (status in ('requested', 'paid')),
  settled_transaction_id uuid references transactions(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table payment_requests enable row level security;

create policy "Users manage their own payment requests"
  on payment_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index payment_requests_reference_code_idx on payment_requests (reference_code);

alter table reclaims add column payment_request_id uuid references payment_requests(id) on delete set null;
create index reclaims_payment_request_id_idx on reclaims (payment_request_id);
