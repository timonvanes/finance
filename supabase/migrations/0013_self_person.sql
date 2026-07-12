-- Marks one person as "this is me" — selectable in a split so the math
-- (equal/weighted division) works out, but no reclaim gets created for
-- their own share.
alter table people add column is_self boolean not null default false;

create unique index people_one_self_per_user_idx
  on people (user_id)
  where is_self;
