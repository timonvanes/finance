-- Short, user-facing code to put in a Tikkie/betaalverzoek description for
-- unambiguous automatic matching.
alter table reclaims
  add column reference_code text unique;

-- Learned person -> counterparty-name mapping, built up from manual links,
-- so future repayments from the same real-world person auto-match even
-- without an exact amount match or reference code.
create table person_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  person_name text not null,
  counterparty_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, person_name, counterparty_name)
);

alter table person_aliases enable row level security;

create policy "Users manage their own person aliases"
  on person_aliases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
