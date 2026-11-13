-- Which places sit in the bottom bar (the rest is under "Meer"). Empty means the
-- standard choice. Each person picks their own.
alter table user_settings add column nav_tabs text[];
