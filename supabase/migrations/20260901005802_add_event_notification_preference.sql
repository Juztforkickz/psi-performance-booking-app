alter table public.notification_preferences
  add column event_alerts_enabled boolean not null default true;

grant update (event_alerts_enabled) on public.notification_preferences to authenticated;
