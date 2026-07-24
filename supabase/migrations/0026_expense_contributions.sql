-- Links incoming money to an outgoing expense it actually funded — e.g.
-- huurtoeslag bundled into a rent payment to the landlord, or someone
-- transferring money upfront so you can make a purchase on their behalf.
-- Unlike reclaims (you pay, then get reimbursed by a tracked person),
-- this covers the reverse/bundled case and isn't tied to a person record.
-- The contributed amount is subtracted from the expense's counted total
-- (category spend, budgets, true-spend) and the source transaction is
-- excluded from income.
create table expense_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  expense_transaction_id uuid not null references transactions(id) on delete cascade,
  source_transaction_id uuid references transactions(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  label text,
  created_at timestamptz not null default now()
);

alter table expense_contributions enable row level security;

create policy "Users manage their own expense contributions"
  on expense_contributions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index expense_contributions_expense_idx on expense_contributions (expense_transaction_id);
create index expense_contributions_source_idx on expense_contributions (source_transaction_id);
