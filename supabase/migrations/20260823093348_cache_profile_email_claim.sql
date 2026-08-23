-- Wrap the verified JWT email claim in one stable statement-level helper so
-- profile policies do not re-evaluate auth.jwt() for every candidate row.

create or replace function private.current_auth_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

revoke all on function private.current_auth_email() from public;
grant execute on function private.current_auth_email() to authenticated;

drop policy if exists "customers can create own profile" on public.customer_profiles;
create policy "customers can create own profile"
on public.customer_profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and email = (select private.current_auth_email())
);

drop policy if exists "customers can update own profile" on public.customer_profiles;
create policy "customers can update own profile"
on public.customer_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and email = (select private.current_auth_email())
);
