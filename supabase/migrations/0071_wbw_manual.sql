-- Filling in WieBetaaltWat by hand (saldo, squaring up) is hidden while the link
-- with WieBetaaltWat works. This switch brings it back, for when WieBetaaltWat
-- blocks the link: nothing else about the manual entry changes.
alter table user_settings add column wbw_manual boolean not null default false;
