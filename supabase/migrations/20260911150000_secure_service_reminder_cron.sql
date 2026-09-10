-- Schedule reminders without copying the project service-role credential into
-- Vault. A dedicated random cron token can only authorize the due-reminder run.
create table private.service_reminder_cron_auth (
  singleton boolean primary key default true check (singleton),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  rotated_at timestamptz not null default now()
);

revoke all on private.service_reminder_cron_auth from public, anon, authenticated;

create or replace function public.verify_service_reminder_cron_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select octet_length(coalesce(p_token, '')) = 64
    and exists (
      select 1
      from private.service_reminder_cron_auth auth
      where auth.singleton
        and auth.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    )
$$;

revoke all on function public.verify_service_reminder_cron_token(text)
from public, anon, authenticated;
grant execute on function public.verify_service_reminder_cron_token(text) to service_role;

do $$
declare
  generated_token text := encode(extensions.gen_random_bytes(32), 'hex');
  secret_id uuid;
begin
  insert into private.service_reminder_cron_auth(singleton, token_hash, rotated_at)
  values (true, encode(extensions.digest(generated_token, 'sha256'), 'hex'), now())
  on conflict (singleton) do update
  set token_hash = excluded.token_hash,
      rotated_at = excluded.rotated_at;

  select id into secret_id from vault.secrets where name = 'psi_service_reminder_cron_token';
  if secret_id is null then
    perform vault.create_secret(generated_token, 'psi_service_reminder_cron_token', 'Dedicated PSI due-reminder scheduler token');
  else
    perform vault.update_secret(secret_id, generated_token, 'psi_service_reminder_cron_token', 'Dedicated PSI due-reminder scheduler token');
  end if;
end
$$;

create or replace function private.invoke_service_due_reminder_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  cron_token text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_project_url';

  select decrypted_secret into cron_token
  from vault.decrypted_secrets
  where name = 'psi_service_reminder_cron_token';

  if project_url is null or cron_token is null then
    raise exception 'service_reminder_scheduler_not_configured';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-booking-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_due_service_reminders","limit":10}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_service_due_reminder_worker()
from public, anon, authenticated, service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'psi-service-due-reminders-daily';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'psi-service-due-reminders-daily',
    '5 0 * * *',
    'select private.invoke_service_due_reminder_worker();'
  );
end
$$;
