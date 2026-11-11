-- Leave existing deposits unchanged while validating the new advance credit flow.
alter table public.booking_xero_deposit_sync
  add column if not exists create_prepayment boolean not null default false;

create or replace function public.booking_xero_prepayment_customer(p_tenant_id uuid, p_customer_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'verified_email', case when u.email_confirmed_at is not null
      and lower(btrim(u.email)) = c.email then c.email end,
    'contact_ids', coalesce((select jsonb_agg(l.contact_id order by l.contact_id)
      from private.xero_customer_links l
      where l.tenant_id = p_tenant_id and l.customer_id = c.user_id), '[]'::jsonb)
  )
  from public.customer_profiles c
  join auth.users u on u.id = c.user_id
  where c.user_id = p_customer_id and c.account_state = 'active';
$$;

revoke all on function public.booking_xero_prepayment_customer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.booking_xero_prepayment_customer(uuid, uuid) to service_role;
