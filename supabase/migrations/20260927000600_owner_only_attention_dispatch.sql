-- Dispatch only the protected owner's unresolved-invoice reminders. This
-- avoids exposing a general notification queue drain to public clients.
create or replace function private.dispatch_owner_attention_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_hour integer := extract(hour from timezone('Australia/Sydney', now()));
  owner_id uuid;
  owner_sound boolean := true;
  unread_count integer := 0;
  pending_count integer := 0;
  sent_count integer := 0;
  device record;
  queued_job record;
  request_id bigint;
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

  select count(*) into pending_count
  from public.push_notification_jobs jobs
  join public.notification_events events on events.id = jobs.event_id
  where jobs.recipient_user_id = owner_id
    and events.kind = 'xero_invoice_review'
    and jobs.status in ('pending', 'failed');

  if pending_count = 0 then
    perform private.queue_owner_attention_reminder();
  end if;

  select coalesce(preferences.sound_enabled, true)
  into owner_sound
  from (select owner_id as id) owner
  left join public.notification_preferences preferences on preferences.user_id = owner.id;

  if exists (
    select 1 from public.notification_preferences
    where user_id = owner_id and workshop_alerts_enabled = false
  ) then
    update public.push_notification_jobs jobs
    set status = 'cancelled', completed_at = now(), last_error_code = 'preference_disabled', updated_at = now()
    from public.notification_events events
    where events.id = jobs.event_id
      and jobs.recipient_user_id = owner_id
      and events.kind = 'xero_invoice_review'
      and jobs.status in ('pending', 'failed');
    return 0;
  end if;

  select count(*) into unread_count
  from public.notification_events
  where recipient_user_id = owner_id and read_at is null;

  for queued_job in
    select jobs.id
    from public.push_notification_jobs jobs
    join public.notification_events events on events.id = jobs.event_id
    where jobs.recipient_user_id = owner_id
      and events.kind = 'xero_invoice_review'
      and jobs.status in ('pending', 'failed')
    order by jobs.created_at
  loop
    for device in
      select expo_push_token
      from public.push_devices
      where user_id = owner_id and enabled = true
    loop
      request_id := net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Accept":"application/json","Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', device.expo_push_token,
          'title', 'PSI invoices need attention',
          'subtitle', 'PSI workshop',
          'body', 'Open Imports & drafts to review unresolved sales invoices.',
          'data', jsonb_build_object('url', '/staff'),
          'badge', unread_count,
          'sound', case when owner_sound then 'default' else null end,
          'channelId', 'psi-workshop',
          'priority', 'high'
        ),
        timeout_milliseconds := 10000
      );
      sent_count := sent_count + 1;
    end loop;

    update public.push_notification_jobs
    set status = case when sent_count > 0 then 'succeeded' else 'cancelled' end,
        attempt_count = least(attempt_count + 1, 20),
        last_attempt_at = now(),
        completed_at = now(),
        provider_ticket_id = case when request_id is null then null else 'pg_net:' || request_id::text end,
        last_error_code = case when sent_count > 0 then null else 'no_registered_device' end,
        updated_at = now()
    where id = queued_job.id;
  end loop;

  return sent_count;
end
$$;

revoke all on function private.dispatch_owner_attention_notifications()
from public, anon, authenticated, service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'psi-owner-attention-reminders';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'psi-owner-attention-reminders',
    '*/30 * * * *',
    'select private.dispatch_owner_attention_notifications();'
  );
end
$$;
