-- Catch up notifications when the originating client cannot dispatch the queue.
-- Credentials remain in Vault and the dispatcher is inaccessible to app roles.
create or replace function private.dispatch_pending_push_notifications()
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
  if not exists (
    select 1 from public.push_notification_jobs
    where status in ('pending', 'failed')
      and available_at <= now()
      and attempt_count < 20
  ) then
    return null;
  end if;

  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';
  select decrypted_secret into anon_jwt from vault.decrypted_secrets
  where name = 'psi_service_reminder_anon_jwt';
  select decrypted_secret into cron_token from vault.decrypted_secrets
  where name = 'psi_service_reminder_cron_token';
  if project_url is null or anon_jwt is null or cron_token is null then
    raise exception 'push_queue_scheduler_not_configured';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'apikey', anon_jwt,
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_queue"}'::jsonb,
    timeout_milliseconds := 30000
  );
end
$$;

revoke all on function private.dispatch_pending_push_notifications()
from public, anon, authenticated, service_role;

select cron.schedule(
  'psi-push-queue-retry', '* * * * *',
  'select private.dispatch_pending_push_notifications();'
);
