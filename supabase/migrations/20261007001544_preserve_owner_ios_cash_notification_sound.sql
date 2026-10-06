create or replace function private.enforce_owner_ios_cash_notification_sound()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform = 'ios'
    and new.enabled
    and exists (
      select 1
      from auth.users
      where id = new.user_id
        and lower(email) = 'matt@psiperformance.com.au'
    )
  then
    new.notification_sound := 'psi_cash_receipt.wav';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_owner_ios_cash_notification_sound()
from public, anon, authenticated, service_role;

drop trigger if exists enforce_owner_ios_cash_notification_sound
on public.push_devices;

create trigger enforce_owner_ios_cash_notification_sound
before insert or update of user_id, platform, enabled, notification_sound
on public.push_devices
for each row execute function private.enforce_owner_ios_cash_notification_sound();

update public.push_devices devices
set notification_sound = 'psi_cash_receipt.wav',
    updated_at = now()
from auth.users users
where users.id = devices.user_id
  and lower(users.email) = 'matt@psiperformance.com.au'
  and devices.platform = 'ios'
  and devices.enabled;
