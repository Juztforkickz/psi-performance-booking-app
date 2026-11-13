-- All existing notification categories start enabled, including car sale email.
-- Initialize missing preferences without overwriting saved customer choices.
alter table public.notification_preferences
  alter column booking_updates_enabled set default true,
  alter column booking_reminders_enabled set default true,
  alter column workshop_alerts_enabled set default true,
  alter column sound_enabled set default true,
  alter column event_alerts_enabled set default true,
  alter column car_sale_alerts_enabled set default true,
  alter column car_sale_emails_enabled set default true;

create or replace function private.initialize_customer_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.notification_preferences (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

revoke all on function private.initialize_customer_notification_preferences()
  from public, anon, authenticated;

create trigger initialize_customer_notification_preferences
after insert on public.customer_profiles
for each row execute function private.initialize_customer_notification_preferences();

insert into public.notification_preferences (user_id)
select user_id
from public.customer_profiles
where account_state = 'active'
on conflict (user_id) do nothing;

