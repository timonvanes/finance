-- Two-step login, enforced in the database itself.
--
-- The app sends anyone who has set up a second step to the code page before showing
-- anything. But the database can also be reached directly with the public key, by someone
-- who only knows a password. These policies close that: for a user who has a verified
-- second step, every table (and the receipts) only answers when the login passed it
-- (the login token says "aal2"). Users without a second step are not affected.
--
-- New tables need the same policy. After creating one, run:
--   create policy mfa_required on public.<table> as restrictive to authenticated
--     using ((select public.mfa_ok()));
-- To undo all of this: supabase/rollbacks/0080_mfa_policies_down.sql

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists mfa_required on public.%I', t.tablename);
    execute format(
      'create policy mfa_required on public.%I as restrictive to authenticated using ((select public.mfa_ok()))',
      t.tablename
    );
  end loop;
end $$;

drop policy if exists mfa_required on storage.objects;
create policy mfa_required on storage.objects as restrictive to authenticated using ((select public.mfa_ok()));
