-- The 6-digit code that unlocks the app (compulsory; Face ID is an extra on top).
-- Only a salted hash is kept, never the code. The table counts wrong attempts so the
-- code cannot be guessed: five wrong in a row wait five minutes, ten log the person out.
-- Row level security is on and there are no ordinary policies on purpose: nothing can
-- read or write this table with a user session, only the server itself.
create table app_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  -- "Forgot the code": set when the person logs out from the lock screen, so that the
  -- next full login (password and second step) asks for a new code.
  reset_pending boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table app_pins enable row level security;

create policy mfa_required on app_pins as restrictive to authenticated
  using ((select public.mfa_ok()));
