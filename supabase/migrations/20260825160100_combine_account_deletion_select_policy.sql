drop policy "customers can view their deletion request"
on public.account_deletion_requests;

drop policy "owner can view deletion requests"
on public.account_deletion_requests;

create policy "customers or owner can view deletion requests"
on public.account_deletion_requests for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.is_owner_staff())
);
