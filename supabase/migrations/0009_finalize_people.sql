-- Run only after the person_name -> person_id backfill has completed for
-- all existing rows (already done by Claude via the service-role key).
alter table reclaims alter column person_id set not null;
alter table reclaims drop column person_name;

alter table person_aliases alter column person_id set not null;
alter table person_aliases drop column person_name;
alter table person_aliases drop constraint if exists person_aliases_user_id_person_name_counterparty_name_key;
alter table person_aliases
  add constraint person_aliases_user_id_person_id_counterparty_name_key
  unique (user_id, person_id, counterparty_name);
