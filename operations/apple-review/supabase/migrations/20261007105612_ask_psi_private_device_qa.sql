-- Sandbox only. Never include in the production migration directory.
create table public.ask_psi_qa_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique check (expo_push_token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  enabled boolean not null default false,
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ask_psi_qa_devices_user_idx on public.ask_psi_qa_devices (user_id);
create table public.ask_psi_qa_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  device_id uuid not null references public.ask_psi_qa_devices(id) on delete cascade,
  status text not null check (status in ('processing', 'submitted', 'unknown', 'held', 'cancelled', 'rejected')),
  provider_ticket_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, device_id)
);
create index ask_psi_qa_deliveries_device_idx on public.ask_psi_qa_deliveries (device_id);
alter table public.ask_psi_qa_devices enable row level security;
alter table public.ask_psi_qa_deliveries enable row level security;
revoke all on public.ask_psi_qa_devices, public.ask_psi_qa_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.ask_psi_qa_devices, public.ask_psi_qa_deliveries to service_role;
comment on table public.ask_psi_qa_devices is 'Private sandbox message test devices. Not used by the normal push worker.';
comment on table public.ask_psi_qa_deliveries is 'Private sandbox one attempt per message event and device. Provider tickets do not prove device delivery.';
