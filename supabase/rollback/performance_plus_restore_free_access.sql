-- Manual, non-destructive rollback for the Stage 4 legacy-invoice access gate.
-- Read docs/PERFORMANCE-PLUS-ROLLBACK.md and verify the target project first.
-- This file is deliberately outside migrations: normal deployment must not run it.
-- It restores the previous own-customer invoice/file-link behaviour only.
-- New vault tables, records, entitlements, private storage and policies remain intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Stop if the original privacy foundation is missing. These checks do not replace
-- reviewing policy definitions and testing with two separate customer identities.
do $$
begin
  if (
    select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relrowsecurity and (n.nspname, c.relname) in
      (('public', 'invoices'), ('public', 'vehicle_files'), ('storage', 'objects'))
  ) <> 3 then
    raise exception 'Rollback stopped: original invoice/file/storage RLS must remain enabled';
  end if;
  if (
    select count(*) from pg_policies where (schemaname, tablename, policyname) in (
      ('public', 'invoices', 'customers can view own invoices'),
      ('public', 'vehicle_files', 'customers can view own vehicle file metadata'),
      ('storage', 'objects', 'customers can view own private files'),
      ('public', 'invoices', 'locked identities cannot access invoices'),
      ('public', 'vehicle_files', 'locked identities cannot access vehicle files'),
      ('storage', 'objects', 'locked identities cannot access private vehicle storage')
    )
  ) <> 6 then
    raise exception 'Rollback stopped: original ownership or deleted-identity policies are missing';
  end if;
  if exists (
    select 1 from storage.buckets
    where id in ('vehicle-photos', 'vehicle-documents', 'performance-vault') and public
  ) then
    raise exception 'Rollback stopped: customer file buckets must remain private';
  end if;
end $$;

-- Exactly the three restrictive policies introduced by
-- 20260908190412_performance_plus_legacy_invoice_access.sql.
drop policy if exists "invoice subscription requirement" on public.invoices;
drop policy if exists "invoice file subscription requirement" on public.vehicle_files;
drop policy if exists "invoice links issued by server only" on storage.objects;

commit;
