-- Categories a transaction can be assigned to.
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table categories enable row level security;

create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Learned counterparty -> category mappings, built up from manual overrides.
create table category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  match_pattern text not null,
  match_type text not null default 'counterparty' check (match_type in ('counterparty')),
  category_id uuid not null references categories(id) on delete cascade,
  last_applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, match_pattern, match_type)
);

alter table category_rules enable row level security;

create policy "Users manage their own category rules"
  on category_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Extend transactions with the category assignment.
alter table transactions
  add column category_id uuid references categories(id) on delete set null,
  add column category_source text not null default 'none'
    check (category_source in ('none', 'rule', 'manual'));

create index transactions_category_id_idx on transactions (category_id);
create index category_rules_user_pattern_idx on category_rules (user_id, match_pattern);
