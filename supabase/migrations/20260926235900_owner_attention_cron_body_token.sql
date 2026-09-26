-- pg_net may omit the custom scheduler header on some hosted routes. Carry the
-- same dedicated, hashed cron credential in the encrypted HTTPS request body.
create or replace function private.invoke_owner_attention_worker()
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
  perform private.queue_owner_attention_reminder();

  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';
  select decrypted_secret into anon_jwt from vault.decrypted_secrets
  where name = 'psi_service_reminder_anon_jwt';
  select decrypted_secret into cron_token from vault.decrypted_secrets
  where name = 'psi_service_reminder_cron_token';

  if project_url is null or anon_jwt is null or cron_token is null then
    raise exception 'owner_attention_scheduler_not_configured';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_jwt,
      'apikey', anon_jwt
    ),
    body := jsonb_build_object('action', 'process_queue', 'cronToken', cron_token),
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_owner_attention_worker()
from public, anon, authenticated, service_role;
