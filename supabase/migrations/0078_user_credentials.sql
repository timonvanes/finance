-- Logins of other services that a user links for themselves (for now WieBetaaltWat).
-- The content is encrypted by the app with a key that only exists in the server
-- settings. Row level security is on and there are no policies on purpose: nothing
-- can read or write this table with a user session, only the server itself.
create table user_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('wbw')),
  secret text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table user_credentials enable row level security;
