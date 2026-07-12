-- Reference codes no longer need to be globally unique: when splitting one
-- transaction among a group via a single shared betaalverzoek, all of them
-- can intentionally share the same code. The matcher disambiguates by
-- amount/name when a code matches more than one open reclaim.
alter table reclaims drop constraint if exists reclaims_reference_code_key;
create index if not exists reclaims_reference_code_idx on reclaims (reference_code);
