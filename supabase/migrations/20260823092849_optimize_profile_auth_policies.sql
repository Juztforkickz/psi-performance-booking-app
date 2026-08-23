-- Keep authentication helpers in init plans so they are evaluated once per
-- statement instead of once per customer profile row.

drop policy if exists "customers can create own profile" on public.customer_profiles;
create policy "customers can create own profile"
on public.customer_profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and email = (select lower(coalesce(auth.jwt() ->> 'email', '')))
);

drop policy if exists "customers can update own profile" on public.customer_profiles;
create policy "customers can update own profile"
on public.customer_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and email = (select lower(coalesce(auth.jwt() ->> 'email', '')))
);
