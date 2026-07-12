-- Some own accounts (e.g. Revolut) aren't linked as a full bank connection,
-- but we still want transfers to/from them recognized and excluded from
-- spend/income. Let the user register just the IBAN for those.
create table manual_own_ibans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  iban text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, iban)
);

alter table manual_own_ibans enable row level security;

create policy "Users manage their own manual IBANs"
  on manual_own_ibans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
