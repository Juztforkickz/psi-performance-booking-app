create or replace function public.resolve_xero_import_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_at timestamptz := now();
begin
  if new.status in ('ignored', 'imported', 'waiting_for_customer')
     and old.status is distinct from new.status then
    update public.notification_events event
    set read_at = coalesce(event.read_at, resolved_at)
    where event.source_event_key = 'xero_invoice_review:' || new.id::text;

    update public.push_notification_jobs job
    set status = 'cancelled',
        completed_at = resolved_at,
        last_error_code = 'xero_import_already_actioned',
        updated_at = resolved_at
    from public.notification_events event
    where job.event_id = event.id
      and event.source_event_key = 'xero_invoice_review:' || new.id::text
      and job.status in ('pending', 'failed');
  end if;
  return new;
end
$$;

drop trigger if exists resolve_xero_import_notification on public.vault_import_queue;
create trigger resolve_xero_import_notification
after update of status on public.vault_import_queue
for each row execute function public.resolve_xero_import_notification();

revoke all on function public.resolve_xero_import_notification() from public, anon, authenticated;
