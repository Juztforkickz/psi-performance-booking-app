-- Keep owner decisions separate from delivery/retry state. Only the backend can
-- enqueue, lease and finish sync work; no customer-facing permissions are added.
alter table public.vault_import_queue
  add column if not exists xero_sync_revision bigint not null default 0,
  add column if not exists xero_sync_processed_revision bigint not null default 0,
  add column if not exists xero_sync_lease uuid,
  add column if not exists xero_sync_lease_until timestamptz,
  add column if not exists xero_sync_previous_status text,
  add column if not exists xero_sync_claim_state jsonb;

create or replace function public.enqueue_xero_invoice_events(p_events jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare e jsonb; q public.vault_import_queue%rowtype; changed integer := 0; inserted_count integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'invalid_events';
  end if;
  for e in select value from jsonb_array_elements(p_events) loop
    -- Casts validate UUIDs; signed webhook chooses the configured tenant.
    perform (e->>'tenantId')::uuid, (e->>'invoiceId')::uuid;
    if e->>'tenantId' is null or e->>'invoiceId' is null then raise exception 'invalid_identity'; end if;
    insert into public.vault_import_queue(source,source_key,status,identifiers,reason)
    values ('xero',(e->>'tenantId')||':'||(e->>'invoiceId'),'pending',e,'Queued for secure Xero invoice inspection.')
    on conflict (source,source_key) do nothing;
    get diagnostics inserted_count = row_count;
    select * into q from public.vault_import_queue
      where source='xero' and source_key=(e->>'tenantId')||':'||(e->>'invoiceId') for update;
    if q.status='ignored' then continue; end if;
    -- New rows have revision zero. Duplicate/older deliveries do no work.
    if inserted_count = 0 and e->>'eventDateUtc' is not null
      and q.identifiers->>'eventDateUtc' is not null
      and (e->>'eventDateUtc')::timestamptz <= (q.identifiers->>'eventDateUtc')::timestamptz then continue; end if;
    update public.vault_import_queue set
      identifiers=identifiers || e,
      xero_sync_revision=xero_sync_revision+1,
      available_at=now(),
      attempt_count=case when xero_sync_lease is null then 0 else attempt_count end
    where id=q.id;
    changed := changed+1;
  end loop;
  return changed;
end $$;

create or replace function public.claim_xero_invoice_sync(p_limit integer default 5,p_queue_id uuid default null)
returns setof public.vault_import_queue language plpgsql security invoker set search_path = '' as $$
declare q public.vault_import_queue%rowtype;
begin
  for q in select * from public.vault_import_queue where source='xero' and status<>'ignored'
    and (xero_sync_lease_until is null or xero_sync_lease_until < now())
    and (p_queue_id is null or id=p_queue_id)
    and (p_queue_id is not null or available_at<=now())
    and attempt_count<20
    and (status in ('pending','matched','failed','processing')
      or (p_queue_id is not null and status='needs_review')
      or xero_sync_revision>xero_sync_processed_revision
      or (xero_sync_lease is not null and xero_sync_lease_until < now()))
    order by available_at,created_at limit greatest(1,least(10,p_limit)) for update skip locked
  loop
    update public.vault_import_queue set
      xero_sync_previous_status=case when status='processing' then coalesce(xero_sync_previous_status,'pending') else status end,
      status=case when status in ('imported','waiting_for_customer','needs_review') then status else 'processing' end,
      xero_sync_claim_state=jsonb_build_object(
        'job_id',job_id,'record_id',record_id,'reason',reason,
        'identifiers',identifiers-'eventDateUtc'-'eventType'),
      xero_sync_lease=gen_random_uuid(), xero_sync_lease_until=now()+interval '5 minutes',
      attempt_count=attempt_count+1,last_attempt_at=now()
    where id=q.id returning * into q;
    return next q;
  end loop;
end $$;

create or replace function public.finish_xero_invoice_sync(p_id uuid,p_lease uuid,p_revision bigint,p_values jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare q public.vault_import_queue%rowtype;
begin
  select * into q from public.vault_import_queue where id=p_id and source='xero' for update;
  if not found or q.xero_sync_lease is distinct from p_lease or p_lease is null then return false; end if;
  if (q.status <> 'processing' and q.status is distinct from q.xero_sync_previous_status)
    or q.xero_sync_claim_state is distinct from jsonb_build_object(
      'job_id',q.job_id,'record_id',q.record_id,'reason',q.reason,
      'identifiers',q.identifiers-'eventDateUtc'-'eventType') then
    -- An owner acted while the network request was in flight. Their decision wins.
    update public.vault_import_queue set xero_sync_lease=null,xero_sync_lease_until=null,xero_sync_previous_status=null,xero_sync_claim_state=null where id=p_id;
    return false;
  end if;
  update public.vault_import_queue set
    status=coalesce(p_values->>'status',status),
    reason=case when p_values ? 'reason' then p_values->>'reason' else reason end,
    identifiers=case when p_values ? 'identifiers' then
      (p_values->'identifiers') || jsonb_build_object('eventDateUtc',identifiers->'eventDateUtc','eventType',identifiers->'eventType')
      else identifiers end,
    job_id=case when p_values ? 'job_id' then (p_values->>'job_id')::uuid else job_id end,
    record_id=case when p_values ? 'record_id' then (p_values->>'record_id')::uuid else record_id end,
    completed_at=case when p_values ? 'completed_at' then (p_values->>'completed_at')::timestamptz else completed_at end,
    last_error_code=case when p_values ? 'last_error_code' then p_values->>'last_error_code' else last_error_code end,
    available_at=case when xero_sync_revision>p_revision then now()
      when p_values ? 'available_at' then (p_values->>'available_at')::timestamptz else available_at end,
    xero_sync_processed_revision=case when p_values->>'last_error_code' is not null then xero_sync_processed_revision
      else greatest(xero_sync_processed_revision,p_revision) end,
    xero_sync_lease=null,xero_sync_lease_until=null,xero_sync_previous_status=null,xero_sync_claim_state=null
  where id=p_id;
  return true;
end $$;

revoke all on function public.enqueue_xero_invoice_events(jsonb) from public,anon,authenticated;
revoke all on function public.claim_xero_invoice_sync(integer,uuid) from public,anon,authenticated;
revoke all on function public.finish_xero_invoice_sync(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_xero_invoice_events(jsonb) to service_role;
grant execute on function public.claim_xero_invoice_sync(integer,uuid) to service_role;
grant execute on function public.finish_xero_invoice_sync(uuid,uuid,bigint,jsonb) to service_role;
