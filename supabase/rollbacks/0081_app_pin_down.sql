-- Undoes 0081_app_pin.sql. Without the table the app no longer asks for a code.
-- (Also remove the pin gate in src/app/(dashboard)/layout.tsx, otherwise the app asks
-- everyone to set a code that cannot be saved.)
drop table if exists app_pins;
