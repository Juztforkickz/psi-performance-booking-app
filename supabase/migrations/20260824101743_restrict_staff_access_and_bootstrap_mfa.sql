-- Keep the initial staff pilot owner-only and provide a deliberately narrow
-- AAL1 bootstrap lookup for the signed-in user's own staff record. Workshop-
-- wide access continues to use private.is_active_staff(), which requires AAL2.

delete from public.staff_members
where user_id is null
  and status = 'pending'
  and email in (
    'dale@psiperformance.com.au',
    'jamie@psiperformance.com.au'
  );

create or replace function public.current_staff_access()
returns setof public.staff_members
language sql
stable
security definer
set search_path = ''
as $$
  select staff.*
  from public.staff_members as staff
  where (select auth.uid()) is not null
    and staff.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_staff_access() from public, anon, authenticated;
grant execute on function public.current_staff_access() to authenticated;
