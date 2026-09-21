-- Web push: one row per device that turned notifications on, plus which kinds
-- of notification each user has switched off.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table push_preferences (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  disabled_types text[] not null default '{}'
);

alter table push_preferences enable row level security;

create policy "Users manage their own push preferences"
  on push_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- bunq calls our callback URL on every account mutation once registered.
alter table bunq_credentials add column callback_registered boolean not null default false;
