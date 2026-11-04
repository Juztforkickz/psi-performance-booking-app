-- The SECURITY INVOKER Rewards coordinator must read previously verified links.
-- Limit the backend to the five identity/verification fields it uses; do not
-- grant any link writing, customer access, credentials or additional schema access.
begin;
do $$ begin
  if to_regclass('private.xero_customer_links') is null then raise exception 'rewards_verified_links_missing'; end if;
  if has_table_privilege('service_role','private.xero_customer_links','INSERT,UPDATE,DELETE') then
    raise exception 'rewards_verified_links_unexpected_writer';
  end if;
  if has_any_column_privilege('authenticated','private.xero_customer_links','SELECT')
    or has_any_column_privilege('anon','private.xero_customer_links','SELECT') then
    raise exception 'rewards_verified_links_customer_access';
  end if;
end $$;

-- The private table previously relied on its PostgreSQL owner-only ACL. Keep
-- those boundaries and add RLS as a second guard before allowing backend reads.
alter table private.xero_customer_links enable row level security;

grant select(tenant_id,contact_id,customer_id,verified_by,verified_at)
  on private.xero_customer_links to service_role;
commit;
