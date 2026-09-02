-- Protected destructive-path acceptance test for the synthetic QATEST1 identity.
-- Every operation is enclosed in one transaction and rolled back.
-- Never remove the final ROLLBACK or replace QATEST1 with a real registration.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create temp table deletion_acceptance_target (
  user_id uuid primary key,
  customer_id uuid not null,
  vehicle_id uuid not null,
  owner_id uuid not null
) on commit drop;

insert into deletion_acceptance_target (user_id, customer_id, vehicle_id, owner_id)
select cp.user_id, cp.user_id, cv.id, owner.user_id
from public.customer_profiles cp
join public.customer_vehicles cv on cv.customer_id = cp.user_id
cross join lateral (
  select sm.user_id
  from public.staff_members sm
  where sm.status = 'active'
    and sm.role = 'owner'
    and lower(btrim(sm.email)) = 'matt@psiperformance.com.au'
  limit 1
) owner
where cv.registration = 'QATEST1'
  and not exists (
    select 1 from public.staff_members sm
    where sm.user_id = cp.user_id and sm.status = 'active'
  );

do $$
declare
  target uuid := (select user_id from deletion_acceptance_target);
begin
  if (select count(*) from deletion_acceptance_target) <> 1 then
    raise exception 'Expected exactly one non-staff QATEST1 synthetic identity and one active Matt owner';
  end if;

  if exists (
    select 1
    from storage.objects object
    where object.bucket_id in ('vehicle-photos', 'vehicle-documents')
      and object.name like target::text || '/%'
  ) then
    raise exception 'QATEST1 owns Storage objects; do not exercise them through this rollback-only SQL test';
  end if;
end
$$;

insert into public.account_deletion_requests (user_id)
select user_id from deletion_acceptance_target
on conflict (user_id) do update
set status = 'requested', completed_at = null, staff_note = null;

select public.begin_customer_account_deletion(
  (select user_id from deletion_acceptance_target),
  (select owner_id from deletion_acceptance_target),
  'Synthetic rollback-only protected deletion acceptance'
);

do $$
declare
  target uuid := (select user_id from deletion_acceptance_target);
begin
  if not exists (
    select 1 from private.deleted_customer_identities deleted
    where deleted.user_id = target and deleted.status = 'processing'
  ) then
    raise exception 'Synthetic identity was not locked before cleanup';
  end if;

  if not exists (
    select 1 from public.customer_profiles profile
    where profile.user_id = target and profile.account_state = 'disabled'
  ) then
    raise exception 'Synthetic customer profile was not disabled';
  end if;
end
$$;

select public.complete_customer_account_data(
  (select user_id from deletion_acceptance_target),
  (select owner_id from deletion_acceptance_target)
);

delete from auth.users
where id = (select user_id from deletion_acceptance_target);

select public.finish_customer_account_deletion(
  (select user_id from deletion_acceptance_target),
  (select owner_id from deletion_acceptance_target)
);

do $$
declare
  target uuid := (select user_id from deletion_acceptance_target);
  candidate record;
  remaining bigint;
begin
  if exists (select 1 from auth.users where id = target) then
    raise exception 'Auth identity remained after synthetic deletion';
  end if;

  if not exists (
    select 1 from private.deleted_customer_identities deleted
    where deleted.user_id = target
      and deleted.status = 'completed'
      and deleted.deletion_completed_at is not null
  ) then
    raise exception 'Synthetic deletion tombstone was not completed';
  end if;

  for candidate in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public' and udt_name = 'uuid'
  loop
    execute format(
      'select count(*) from %I.%I where %I = $1',
      candidate.table_schema,
      candidate.table_name,
      candidate.column_name
    ) into remaining using target;
    if remaining > 0 then
      raise exception 'Synthetic identity remained in %.% column %',
        candidate.table_schema, candidate.table_name, candidate.column_name;
    end if;
  end loop;
end
$$;

rollback;
