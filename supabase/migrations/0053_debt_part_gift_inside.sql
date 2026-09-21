-- The gift adjustment sits inside specific parts (the ones that contain
-- prestatiebeurs). Only those parts have their interest reduced by it.
alter table debt_parts add column gift_inside boolean not null default false;
