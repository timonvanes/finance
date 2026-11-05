-- Where a WieBetaaltWat reclaim goes: the list and the member in it, chosen when
-- the reclaim is made, so putting it into WieBetaaltWat later is one tap and the
-- split never has to be entered twice.
alter table reclaims add column wbw_list_id text;
alter table reclaims add column wbw_member_id text;

-- Reclaims with the same group id are combined: they are put into WieBetaaltWat
-- together as ONE expense (the bills add up, each person's parts add up). Without
-- a group id every payment becomes its own expense.
alter table reclaims add column wbw_group_id text;

-- The expense these reclaims became in WieBetaaltWat. Kept so that deleting the
-- expense there can be noticed and followed here.
alter table reclaims add column wbw_expense_id text;
