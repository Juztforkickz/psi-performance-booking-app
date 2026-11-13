-- Roll back all preference changes, including the temporary trigger test.
begin;
create temporary table notification_profile_probe (user_id uuid);
create trigger initialize_preferences_probe
after insert on notification_profile_probe
for each row execute function private.initialize_customer_notification_preferences();

do $test$
declare
  probe_user uuid;
  before_notifications bigint;
begin
  select count(*) into before_notifications from public.notification_events;
  select user_id into strict probe_user from public.customer_profiles
  where account_state = 'active' order by created_at limit 1;

  if not exists(select 1 from pg_trigger where tgname='initialize_customer_notification_preferences'
    and tgrelid='public.customer_profiles'::regclass) then
    raise exception 'New customer profile trigger is missing';
  end if;
  if has_function_privilege('anon', 'private.initialize_customer_notification_preferences()', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.initialize_customer_notification_preferences()', 'EXECUTE') then
    raise exception 'Trigger function is exposed to app users';
  end if;

  update public.notification_preferences set event_alerts_enabled=false,
    sound_enabled=false, car_sale_emails_enabled=false where user_id=probe_user;
  insert into notification_profile_probe(user_id) values(probe_user);
  if not exists(select 1 from public.notification_preferences where user_id=probe_user
    and not event_alerts_enabled and not sound_enabled and not car_sale_emails_enabled) then
    raise exception 'Initialization overwrote a later customer opt-out';
  end if;

  delete from public.notification_preferences where user_id=probe_user;
  insert into notification_profile_probe(user_id) values(probe_user);
  if not exists(select 1 from public.notification_preferences where user_id=probe_user
    and booking_updates_enabled and booking_reminders_enabled and workshop_alerts_enabled
    and sound_enabled and event_alerts_enabled and car_sale_alerts_enabled and car_sale_emails_enabled) then
    raise exception 'A newly initialized account did not receive enabled defaults';
  end if;
  if (select count(*) from public.notification_events)<>before_notifications then
    raise exception 'Preference initialization generated a notification';
  end if;
end;
$test$;
select 'passed: enabled defaults, preserved opt-out, private trigger, no alerts generated' as result;
rollback;

