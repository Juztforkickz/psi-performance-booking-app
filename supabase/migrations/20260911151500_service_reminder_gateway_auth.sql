-- Preserve Supabase gateway JWT verification for the scheduled request. The
-- public anon JWT crosses the gateway; the separate random cron token remains
-- the only credential that authorizes due-reminder processing.
create or replace function private.invoke_service_due_reminder_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  anon_jwt text;
  cron_token text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';

  select decrypted_secret into anon_jwt
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_anon_jwt';

  select decrypted_secret into cron_token
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_cron_token';

  if project_url is null or anon_jwt is null or cron_token is null then
    raise exception 'service_reminder_scheduler_not_configured';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-booking-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'apikey', anon_jwt,
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_due_service_reminders","limit":10}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_service_due_reminder_worker()
from public, anon, authenticated, service_role;
