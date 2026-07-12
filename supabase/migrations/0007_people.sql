-- A reusable roster of people you reclaim money from/back, so you add
-- someone once and just pick them (checkbox) from then on.
create table people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table people enable row level security;

create policy "Users manage their own people"
  on people for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nullable for now — a backfill migrates existing reclaims.person_name /
-- person_aliases.person_name into people + person_id before a follow-up
-- migration makes this required and drops the old text columns.
alter table reclaims add column person_id uuid references people(id);
alter table person_aliases add column person_id uuid references people(id);
