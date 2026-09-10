-- Call the due-reminder worker once daily after 9am in Melbourne in both
-- standard and daylight-saving time. Project-specific values live in Vault;
-- the service-role credential never enters source control or cron history.
create or replace function private.invoke_service_due_reminder_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  service_role_key text;
begin
  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';

  select decrypted_secret
  into service_role_key
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_service_role';

  if project_url is null or service_role_key is null then
    raise exception 'service_reminder_scheduler_not_configured';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-booking-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{"action":"process_due_service_reminders","limit":10}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_service_due_reminder_worker()
from public, anon, authenticated, service_role;

select cron.schedule(
  'psi-service-due-reminders-daily',
  '5 0 * * *',
  'select private.invoke_service_due_reminder_worker();'
);
