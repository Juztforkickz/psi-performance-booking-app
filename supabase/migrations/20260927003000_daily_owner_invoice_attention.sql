-- Keep unresolved owner-only invoice exceptions visible without noisy alerts.
-- The scheduler checks regularly so daylight-saving changes are respected, but
-- it creates at most one reminder per Australia/Sydney calendar day.
create or replace function private.queue_owner_attention_reminder()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_now timestamp := timezone('Australia/Sydney', now());
  local_hour integer := extract(hour from local_now);
  owner_id uuid;
  unresolved_count integer := 0;
  draft_count integer := 0;
  match_count integer := 0;
  reminder_event_id uuid;
begin
  if local_hour < 8 or local_hour >= 20 then
    return 0;
  end if;

  if not pg_try_advisory_xact_lock(hashtext('psi-owner-daily-invoice-reminder')) then
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
      and timezone('Australia/Sydney', created_at)::date = local_now::date
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
    'xero_attention_reminder:' || to_char(local_now, 'YYYYMMDD')
  )
  returning id into reminder_event_id;

  insert into public.push_notification_jobs (event_id, booking_request_id, recipient_user_id)
  values (reminder_event_id, null, owner_id);

  return 1;
end
$$;

revoke all on function private.queue_owner_attention_reminder()
from public, anon, authenticated, service_role;
