-- Order-level discount (coupon / korting on the whole order), spread over the
-- items when working out what a return should bring back.
alter table orders add column discount_total numeric(12, 2) not null default 0;

-- "Op rekening" (pay after delivery on an invoice): a return is credited on the
-- invoice, like Klarna, instead of paid back to the bank.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('direct', 'klarna', 'invoice'));

-- Compensation claimed later (bad quality, complaint), with or without
-- sending the item back.
create table order_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_id uuid not null references orders(id) on delete cascade,
  reason text,
  expected_amount numeric(12, 2) not null check (expected_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'received')),
  refund_transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table order_claims enable row level security;

create policy "Users manage their own order claims"
  on order_claims for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index order_claims_order_idx on order_claims (order_id);
