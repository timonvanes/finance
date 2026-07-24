-- Free-text notes so you can later remember what a transaction/reclaim was
-- actually about, plus a receipt attachment for reclaims.
alter table transactions add column note text;
alter table reclaims add column note text;
alter table reclaims add column receipt_path text;

-- Private bucket for receipt photos/PDFs, one folder per user
-- ({user_id}/{reclaim_id}/{filename}) so RLS can scope access.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Users manage their own receipts"
  on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
