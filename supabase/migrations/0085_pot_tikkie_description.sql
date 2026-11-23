-- The description of the Tikkie for a pot (for example with a reference code so the deposit can
-- be recognised). Null = the default "Sparen <name of the pot>".
alter table pots add column tikkie_description text check (tikkie_description is null or char_length(tikkie_description) <= 35);
