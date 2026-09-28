-- Order/bestelnummer, when the shop provides one: an exact match beats
-- item-text similarity for telling apart two near-identical repeat orders.
alter table orders add column order_reference text;
create index orders_reference_idx on orders (user_id, order_reference) where order_reference is not null;

-- Physical (in-store) purchases, added by scanning a receipt, vs. online
-- orders added from a mail. A scanned receipt image is kept the same way an
-- existing "receipts" bucket already keeps reclaim receipts.
alter table orders
  add column channel text not null default 'online' check (channel in ('online', 'physical')),
  add column receipt_path text;
