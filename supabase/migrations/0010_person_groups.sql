-- Groups to organize people into (e.g. "Vrienden", "Familie", "Sportclub"),
-- separate from transaction categories.
create table person_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table person_groups enable row level security;

create policy "Users manage their own person groups"
  on person_groups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table people add column person_group_id uuid references person_groups(id) on delete set null;
