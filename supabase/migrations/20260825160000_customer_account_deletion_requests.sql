create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'in_review', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  staff_note text,
  updated_at timestamptz not null default now(),
  constraint account_deletion_completed_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index account_deletion_requests_status_time_idx
on public.account_deletion_requests (status, requested_at);

create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function private.set_updated_at();

create trigger audit_account_deletion_requests
after insert or update or delete on public.account_deletion_requests
for each row execute function private.record_audit_event();

alter table public.account_deletion_requests enable row level security;

create policy "customers can view their deletion request"
on public.account_deletion_requests for select to authenticated
using ((select auth.uid()) = user_id);

create policy "owner can view deletion requests"
on public.account_deletion_requests for select to authenticated
using ((select private.is_owner_staff()));

create policy "customers can request their own account deletion"
on public.account_deletion_requests for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'requested'
  and completed_at is null
  and staff_note is null
  and not exists (
    select 1 from public.staff_members
    where staff_members.user_id = (select auth.uid())
      and staff_members.status = 'active'
  )
);

create policy "customers can cancel a pending deletion request"
on public.account_deletion_requests for delete to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'requested'
  and not exists (
    select 1 from public.staff_members
    where staff_members.user_id = (select auth.uid())
      and staff_members.status = 'active'
  )
);

create policy "owner can process deletion requests"
on public.account_deletion_requests for update to authenticated
using ((select private.is_owner_staff()))
with check ((select private.is_owner_staff()));

revoke all on public.account_deletion_requests from anon, authenticated;
grant select, delete on public.account_deletion_requests to authenticated;
grant insert (user_id) on public.account_deletion_requests to authenticated;
grant update (status, completed_at, staff_note, updated_at) on public.account_deletion_requests to authenticated;
