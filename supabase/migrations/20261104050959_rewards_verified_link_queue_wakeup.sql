-- Wake only an existing ownership hold when the trusted account-claim workflow
-- verifies its Xero link. Never award points or modify a membership here.
begin;

do $$ begin
  if not exists(select 1 from private.rewards_bonus_schema_version
    where version=2 and contract_sha256=private.rewards_bonus_schema_contract()) then
    raise exception 'rewards_bonus_schema_mismatch';
  end if;
end $$;

create or replace function private.queue_rewards_after_verified_xero_link()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.verified_at is null or new.verified_by is null then return new; end if;
  if tg_op='UPDATE' then
    if new.customer_id is not distinct from old.customer_id
      and new.verified_by is not distinct from old.verified_by
      and new.verified_at is not distinct from old.verified_at then return new; end if;
  end if;
  if not exists(select 1 from public.customer_profiles c
    where c.user_id=new.customer_id and c.account_state='active') then return new; end if;

  with candidates as (
    select q.tenant_id,q.invoice_id
    from public.rewards_invoice_queue q
    join public.rewards_config c on c.tenant_id=q.tenant_id and c.enabled
    where q.tenant_id=new.tenant_id and q.revision>q.processed_revision
      and q.last_error='verified_rewards_customer_required'
      and exists(select 1 from public.vault_import_queue v where v.source='xero'
        and v.identifiers->>'tenantId'=new.tenant_id::text
        and v.identifiers->>'contactId'=new.contact_id::text
        and v.identifiers->>'invoiceId'=q.invoice_id::text)
    for update of q
  ), changed as (
    update public.rewards_invoice_queue q
    set revision=q.revision+1,attempts=0,last_error=null,available_at=now()
    from candidates c where q.tenant_id=c.tenant_id and q.invoice_id=c.invoice_id
    -- Retain any active lease. Its old revision cannot settle the new revision.
    returning q.invoice_id
  )
  insert into public.audit_events(table_name,record_id,customer_id,action,actor_user_id,actor_kind)
  select 'rewards_invoice_queue',invoice_id,new.customer_id,'update',null,'system' from changed;
  -- The existing worker refetches Xero, enforces the configured Melbourne launch
  -- date and verified paid windows, and applies its duplicate-safe ledger.
  return new;
end $$;

revoke all on function private.queue_rewards_after_verified_xero_link()
  from public,anon,authenticated,service_role;

drop trigger if exists rewards_verified_link_queue_wakeup on private.xero_customer_links;
create trigger rewards_verified_link_queue_wakeup
after insert or update of customer_id,verified_by,verified_at on private.xero_customer_links
for each row execute function private.queue_rewards_after_verified_xero_link();

commit;
