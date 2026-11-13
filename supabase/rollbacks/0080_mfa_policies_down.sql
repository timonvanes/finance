-- Undoes 0080_mfa_policies.sql. Run it in the Supabase SQL editor if the app suddenly
-- shows no data for someone with a second step.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists mfa_required on public.%I', t.tablename);
  end loop;
end $$;
drop policy if exists mfa_required on storage.objects;
drop function if exists public.mfa_ok();
