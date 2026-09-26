-- Keep unresolved owner-only invoice exceptions visible without noisy overnight alerts.
-- The scheduler checks every 30 minutes, but creates at most one reminder every
-- four hours between 8am and 8pm in the workshop's Australia/Sydney timezone.
create or replace function private.queue_owner_attention_reminder()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_hour integer := extract(hour from timezone('Australia/Sydney', now()));
  owner_id uuid;
  unresolved_count integer := 0;
  draft_count integer := 0;
  match_count integer := 0;
  reminder_event_id uuid;
begin
  if local_hour < 8 or local_hour >= 20 then
    return 0;
  end if;

  select id into owner_id
  from auth.users
  where lower(email) = 'matt@psiperformance.com.au'
  limit 1;

  if owner_id is null then
    return 0;
  end if;

  select
    count(*),
    count(*) filter (where reason = 'invoice_status_requires_review'),
    count(*) filter (where reason = 'verified_customer_link_required')
  into unresolved_count, draft_count, match_count
  from public.vault_import_queue
  where source = 'xero'
    and status = 'needs_review';

  if unresolved_count = 0 or exists (
    select 1
    from public.notification_events
    where recipient_user_id = owner_id
      and kind = 'xero_invoice_review'
      and source_event_key like 'xero_attention_reminder:%'
      and created_at > now() - interval '4 hours'
  ) then
    return 0;
  end if;

  insert into public.notification_events (
    recipient_user_id,
    booking_request_id,
    kind,
    title,
    body,
    deep_link,
    source_event_key
  ) values (
    owner_id,
    null,
    'xero_invoice_review',
    'Sales invoices still need attention',
    format('%s sales invoices need review: %s need a customer match and %s remain drafts in Xero.', unresolved_count, match_count, draft_count),
    '/staff',
    'xero_attention_reminder:' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISS')
  )
  returning id into reminder_event_id;

  insert into public.push_notification_jobs (event_id, booking_request_id, recipient_user_id)
  values (reminder_event_id, null, owner_id);

  return 1;
end
$$;

revoke all on function private.queue_owner_attention_reminder()
from public, anon, authenticated, service_role;

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
      'apikey', anon_jwt,
      'x-psi-cron-token', cron_token
    ),
    body := '{"action":"process_queue"}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function private.invoke_owner_attention_worker()
from public, anon, authenticated, service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'psi-owner-attention-reminders';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'psi-owner-attention-reminders',
    '*/30 * * * *',
    'select private.invoke_owner_attention_worker();'
  );
end
$$;
