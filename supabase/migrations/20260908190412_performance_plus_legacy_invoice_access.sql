-- Protect historical invoices as well as the new archive.
create policy "invoice subscription requirement" on public.invoices as restrictive for select to authenticated
 using((select private.has_performance_plus()) or (select private.is_active_staff()));
create policy "invoice file subscription requirement" on public.vehicle_files as restrictive for select to authenticated
 using(file_kind<>'invoice' or (select private.has_performance_plus()) or (select private.is_active_staff()));
create or replace function private.is_legacy_invoice_path(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vehicle_files where bucket_id='vehicle-documents' and object_path=p_path and file_kind='invoice')
$$;
revoke all on function private.is_legacy_invoice_path(text) from public,anon;
grant execute on function private.is_legacy_invoice_path(text) to authenticated;
create policy "invoice links issued by server only" on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'vehicle-documents' or (select private.is_active_staff()) or not private.is_legacy_invoice_path(name));

-- Keep definer internals outside the exposed API schema.
alter function public.performance_vault_overview(uuid) set schema private;
alter function public.grant_performance_beta(uuid,integer) set schema private;
create function public.performance_vault_overview(p_vehicle_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.performance_vault_overview(p_vehicle_id)
$$;
create function public.grant_performance_beta(p_customer_id uuid,p_days integer) returns void language sql security invoker set search_path='' as $$
 select private.grant_performance_beta(p_customer_id,p_days)
$$;
revoke all on function public.performance_vault_overview(uuid),public.grant_performance_beta(uuid,integer) from public,anon;
grant execute on function public.performance_vault_overview(uuid),public.grant_performance_beta(uuid,integer) to authenticated;
