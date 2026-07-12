-- Order confirmations (parsed from pasted emails) and their line items, so a
-- partial return (kept some items, sent back others) can compute the exact
-- expected refund instead of assuming the full purchase amount comes back.
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  merchant_name text not null,
  order_date date,
  total_amount numeric(12, 2),
  source_text text,
  transaction_id uuid references transactions(id) on delete set null,
  refund_transaction_id uuid references transactions(id) on delete set null,
  refund_status text not null default 'not_returned'
    check (refund_status in ('not_returned', 'pending', 'refunded')),
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

create policy "Users manage their own orders"
  on orders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_id uuid not null references orders(id) on delete cascade,
  description text not null,
  price numeric(12, 2) not null,
  quantity integer not null default 1,
  returned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table order_items enable row level security;

create policy "Users manage their own order items"
  on order_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index order_items_order_id_idx on order_items (order_id);
create index orders_refund_status_idx on orders (user_id, refund_status);
