-- Durable Xero import processing and explicit owner-controlled contact/job matching.
alter table public.vault_import_queue
  drop constraint vault_import_queue_status_check;
alter table public.vault_import_queue
  add constraint vault_import_queue_status_check
  check (status in ('pending','processing','needs_review','matched','imported','failed','ignored'));

alter table public.vault_import_queue
  add column attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  add column available_at timestamptz not null default now(),
  add column last_attempt_at timestamptz,
  add column completed_at timestamptz,
  add column last_error_code text check (last_error_code is null or octet_length(last_error_code) <= 160),
  add column record_id uuid references public.vault_records(id) on delete set null,
  add column updated_at timestamptz not null default now();

create index vault_import_queue_pending_idx
  on public.vault_import_queue(status, available_at, created_at)
  where status in ('pending','matched','failed');

create trigger vault_import_queue_set_updated_at
before update on public.vault_import_queue
for each row execute function private.set_updated_at();

create or replace function public.xero_customer_link_context(
  p_tenant_id uuid,
  p_contact_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'tenant_id', link.tenant_id,
        'contact_id', link.contact_id,
        'customer_id', link.customer_id,
        'verified_by', link.verified_by,
        'verified_at', link.verified_at
      )
      from private.xero_customer_links link
      where link.tenant_id = p_tenant_id and link.contact_id = p_contact_id
    ),
    'null'::jsonb
  )
$$;

revoke all on function public.xero_customer_link_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.xero_customer_link_context(uuid, uuid) to service_role;

create or replace function public.confirm_xero_import_match(
  p_queue_id uuid,
  p_customer_id uuid,
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued public.vault_import_queue%rowtype;
  job public.workshop_jobs%rowtype;
  tenant_id uuid;
  contact_id uuid;
  invoice_reference text;
begin
  if not private.is_owner_staff() then
    raise exception 'owner_aal2_required' using errcode = '42501';
  end if;

  select * into queued
  from public.vault_import_queue
  where id = p_queue_id and source = 'xero' and status in ('needs_review','failed')
  for update;
  if not found then raise exception 'xero_import_not_reviewable'; end if;

  begin
    tenant_id := (queued.identifiers ->> 'tenantId')::uuid;
    contact_id := (queued.identifiers ->> 'contactId')::uuid;
  exception when others then
    raise exception 'xero_invoice_details_required';
  end;
  invoice_reference := upper(btrim(coalesce(queued.identifiers ->> 'reference', '')));

  select * into job from public.workshop_jobs where id = p_job_id;
  if not found
    or job.customer_id <> p_customer_id
    or upper(btrim(job.reference)) <> invoice_reference
    or not exists (
      select 1 from public.customer_vehicles vehicle
      where vehicle.id = job.vehicle_id
        and vehicle.customer_id = p_customer_id
        and vehicle.archived_at is null
    )
    or not exists (
      select 1 from public.customer_profiles profile
      where profile.user_id = p_customer_id and profile.account_state = 'active'
    ) then
    raise exception 'xero_customer_vehicle_job_mismatch';
  end if;

  insert into private.xero_customer_links(
    tenant_id, contact_id, customer_id, verified_by, verified_at
  ) values (
    tenant_id, contact_id, p_customer_id, (select auth.uid()), now()
  )
  on conflict (tenant_id, contact_id) do update
  set customer_id = excluded.customer_id,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at;

  update public.vault_import_queue
  set job_id = p_job_id,
      status = 'matched',
      reason = 'Customer, vehicle and exact PSI job reference verified by the owner.',
      available_at = now(),
      last_error_code = null,
      completed_at = null
  where id = p_queue_id;
end
$$;

revoke all on function public.confirm_xero_import_match(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_xero_import_match(uuid, uuid, uuid) to authenticated;

-- Existing webhook rows pre-date the pending state and should be inspected once.
update public.vault_import_queue
set status = 'pending', reason = 'Queued for secure Xero invoice inspection.'
where source = 'xero' and status = 'needs_review' and identifiers ? 'invoiceId';
