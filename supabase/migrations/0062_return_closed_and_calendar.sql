-- An order the user has decided nothing will be returned from: ticked off, no
-- more deadline reminders, with an optional remark.
alter table orders
  add column return_closed boolean not null default false,
  add column return_note text;

-- Secret in the URL of the user's calendar subscription (return deadlines).
alter table user_settings add column calendar_token text unique;
