create table public.customer_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending_profile' check (status in ('pending_profile', 'profile_complete')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint customer_invitations_email_normalized check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 160
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint customer_invitations_acceptance_consistent check (
    (status = 'pending_profile' and accepted_at is null)
    or (status = 'profile_complete' and accepted_at is not null)
  )
);

comment on table public.customer_invitations is
  'Owner-created customer access approvals. Auth users are created only by the protected invite-customer Edge Function.';

create index customer_invitations_invited_by_idx
on public.customer_invitations (invited_by);

create index customer_invitations_status_invited_at_idx
on public.customer_invitations (status, invited_at desc);

create trigger customer_invitations_set_updated_at
before update on public.customer_invitations
for each row execute function private.set_updated_at();

create or replace function private.sync_customer_invitation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.first_name, '')), '') is not null
    and nullif(btrim(coalesce(new.last_name, '')), '') is not null
    and nullif(btrim(coalesce(new.mobile, '')), '') is not null then
    update public.customer_invitations
    set status = 'profile_complete',
        accepted_at = coalesce(accepted_at, now()),
        updated_at = now()
    where auth_user_id = new.user_id
      and status = 'pending_profile';
  end if;
  return new;
end
$$;

revoke all on function private.sync_customer_invitation_status() from public, anon, authenticated;

create trigger sync_customer_invitation_status
after insert or update of first_name, last_name, mobile on public.customer_profiles
for each row execute function private.sync_customer_invitation_status();

alter table public.customer_invitations enable row level security;

create policy "owner can view customer invitations"
on public.customer_invitations for select to authenticated
using ((select private.is_owner_staff()));

revoke all on public.customer_invitations from public, anon, authenticated;
grant select on public.customer_invitations to authenticated;
