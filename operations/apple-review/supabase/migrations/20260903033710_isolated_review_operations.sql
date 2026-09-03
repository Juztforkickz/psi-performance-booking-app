-- ISOLATED REVIEW ONLY. Live migrations must never include this file.
do $$
begin
  if not exists (select 1 from private.apple_review_installation where project_ref = 'jwikoldibbpxyhbdrsow')
  then raise exception 'ISOLATED_REVIEW_INSTALLATION_REQUIRED'; end if;
end $$;

create function public.apple_review_staff_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_owner_staff()
$$;
revoke all on function public.apple_review_staff_access() from public, anon, service_role;
grant execute on function public.apple_review_staff_access() to authenticated;

create or replace function public.begin_customer_account_deletion(
  p_user_id uuid,
  p_completed_by uuid,
  p_staff_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_deletion_requests%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_user_id is null or p_completed_by is null then
    raise exception 'deletion_target_required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = p_completed_by
      and staff.status = 'active'
      and staff.role = 'owner'
      and lower(btrim(staff.email)) = 'psiappreview+staff@gmail.com'
  ) then
    raise exception 'owner_required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.staff_members staff
    where staff.user_id = p_user_id
      and staff.status = 'active'
  ) then
    raise exception 'staff_identity_cannot_be_deleted' using errcode = '42501';
  end if;

  select * into request_row
  from public.account_deletion_requests request
  where request.user_id = p_user_id
    and request.status in ('requested', 'in_review')
  for update;
  if not found then
    raise exception 'active_deletion_request_required' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.customer_profiles customer where customer.user_id = p_user_id
  ) and not exists (
    select 1 from private.deleted_customer_identities deleted_identity
    where deleted_identity.user_id = p_user_id and deleted_identity.status = 'processing'
  ) then
    raise exception 'customer_profile_not_found' using errcode = 'P0002';
  end if;

  insert into private.deleted_customer_identities (
    user_id,
    deletion_requested_at,
    deletion_started_at,
    completed_by,
    status
  ) values (
    p_user_id,
    request_row.requested_at,
    now(),
    p_completed_by,
    'processing'
  )
  on conflict (user_id) do update
  set completed_by = excluded.completed_by,
      status = 'processing';

  update public.customer_profiles
  set account_state = 'disabled', updated_at = now()
  where user_id = p_user_id;

  update public.account_deletion_requests
  set status = 'in_review',
      staff_note = nullif(left(btrim(coalesce(p_staff_note, '')), 500), ''),
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'locked', true,
    'requestedAt', request_row.requested_at
  );
end
$$;
