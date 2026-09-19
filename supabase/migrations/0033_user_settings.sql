-- Per-user app settings. month_start_day: the day budget "months" begin
-- (e.g. 25 = from salary day to the day before the next one).
create table user_settings (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
