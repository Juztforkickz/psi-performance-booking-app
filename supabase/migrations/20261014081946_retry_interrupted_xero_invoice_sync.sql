-- Uses the existing protected scheduler credentials; no owner session is created.
create or replace function private.dispatch_xero_invoice_sync()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare project_url text; anon_jwt text; cron_token text;
begin
  if not exists (
    select 1 from public.vault_import_queue where source='xero' and status<>'ignored'
      and available_at<=now() and attempt_count<20
      and (xero_sync_lease_until is null or xero_sync_lease_until<now())
      and (status in ('pending','matched','failed','processing')
        or xero_sync_revision>xero_sync_processed_revision
        or (xero_sync_lease is not null and xero_sync_lease_until<now()))
  ) then return null; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name='psi_service_reminder_project_url';
  select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='psi_service_reminder_anon_jwt';
  select decrypted_secret into cron_token from vault.decrypted_secrets where name='psi_service_reminder_cron_token';
  if project_url is null or anon_jwt is null or cron_token is null then raise exception 'xero_scheduler_credentials_missing'; end if;
  return net.http_post(
    url:=rtrim(project_url,'/')||'/functions/v1/process-xero-imports',
    headers:=jsonb_build_object('Authorization','Bearer '||anon_jwt,'Content-Type','application/json'),
    body:=jsonb_build_object('action','process_queue','limit',5,'cronToken',cron_token)
  );
end $$;
revoke all on function private.dispatch_xero_invoice_sync() from public,anon,authenticated,service_role;
grant execute on function private.dispatch_xero_invoice_sync() to postgres;
select cron.schedule('psi-xero-invoice-sync-retry','*/5 * * * *','select private.dispatch_xero_invoice_sync();');
