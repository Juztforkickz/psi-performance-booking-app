-- Ask PSI private messaging foundation.
--
-- This migration is intentionally backend only. It does not add a visible app
-- route or publish the feature. Customers may access only their own
-- conversations. Active PSI staff require AAL2 through private.is_active_staff().

create table public.ask_psi_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  vehicle_id uuid references public.customer_vehicles(id) on delete set null,
  booking_request_id uuid references public.booking_requests(id) on delete set null,
  topic text not null check (topic in (
    'service',
    'booking',
    'vehicle_fault',
    'dyno',
    'records',
    'performance_build',
    'sell_my_car',
    'other'
  )),
  status text not null default 'awaiting_psi' check (status in (
    'open',
    'awaiting_psi',
    'awaiting_customer',
    'closed'
  )),
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_staff_id uuid references auth.users(id) on delete set null,
  customer_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ask_psi_conversations_closed_state_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create index ask_psi_conversations_customer_recent_idx
on public.ask_psi_conversations (customer_id, last_message_at desc);

create index ask_psi_conversations_staff_inbox_idx
on public.ask_psi_conversations (status, last_message_at desc);

create index ask_psi_conversations_vehicle_idx
on public.ask_psi_conversations (vehicle_id, last_message_at desc)
where vehicle_id is not null;

create index ask_psi_conversations_booking_idx
on public.ask_psi_conversations (booking_request_id)
where booking_request_id is not null;

create index ask_psi_conversations_assigned_staff_idx
on public.ask_psi_conversations (assigned_staff_id, last_message_at desc)
where assigned_staff_id is not null;

create table public.ask_psi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ask_psi_conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_kind text not null check (sender_kind in ('customer', 'staff', 'assistant', 'system')),
  message_kind text not null default 'text' check (message_kind in ('text', 'photo', 'system')),
  body text,
  client_nonce uuid,
  created_at timestamptz not null default now(),
  constraint ask_psi_messages_body_check check (
    (message_kind = 'text' and body is not null and char_length(btrim(body)) between 1 and 4000)
    or (message_kind = 'photo' and (body is null or char_length(btrim(body)) between 1 and 1000))
    or (message_kind = 'system' and body is not null and char_length(btrim(body)) between 1 and 1000)
  ),
  constraint ask_psi_messages_sender_check check (
    (sender_kind in ('customer', 'staff') and sender_user_id is not null)
    or (sender_kind in ('assistant', 'system'))
  )
);

create unique index ask_psi_messages_client_nonce_unique_idx
on public.ask_psi_messages (conversation_id, client_nonce)
where client_nonce is not null;

create index ask_psi_messages_conversation_time_idx
on public.ask_psi_messages (conversation_id, created_at, id);

create index ask_psi_messages_sender_idx
on public.ask_psi_messages (sender_user_id, created_at desc)
where sender_user_id is not null;

create table public.ask_psi_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.ask_psi_messages(id) on delete cascade,
  bucket_id text not null default 'ask-psi-media' check (bucket_id = 'ask-psi-media'),
  object_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  width integer check (width is null or width between 1 and 12000),
  height integer check (height is null or height between 1 and 12000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create index ask_psi_attachments_message_idx
on public.ask_psi_attachments (message_id, created_at);

create table public.ask_psi_email_jobs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ask_psi_conversations(id) on delete cascade,
  message_id uuid not null references public.ask_psi_messages(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'microsoft_365' check (provider = 'microsoft_365'),
  status text not null default 'pending' check (status in (
    'pending',
    'processing',
    'blocked_configuration',
    'succeeded',
    'failed',
    'cancelled'
  )),
  available_at timestamptz not null default (now() + interval '15 minutes'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  provider_reference text check (provider_reference is null or octet_length(provider_reference) <= 500),
  last_error_code text check (last_error_code is null or octet_length(last_error_code) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, recipient_user_id)
);

create index ask_psi_email_jobs_ready_idx
on public.ask_psi_email_jobs (status, available_at, created_at)
where status in ('pending', 'failed', 'blocked_configuration');

create index ask_psi_email_jobs_conversation_idx
on public.ask_psi_email_jobs (conversation_id, created_at desc);

alter table public.ask_psi_conversations enable row level security;
alter table public.ask_psi_messages enable row level security;
alter table public.ask_psi_attachments enable row level security;
alter table public.ask_psi_email_jobs enable row level security;

create policy ask_psi_conversations_customer_select
on public.ask_psi_conversations for select to authenticated
using (
  ask_psi_conversations.customer_id = (select auth.uid())
  or (select private.is_active_staff())
);

create policy ask_psi_conversations_customer_insert
on public.ask_psi_conversations for insert to authenticated
with check (
  ask_psi_conversations.customer_id = (select auth.uid())
  and ask_psi_conversations.created_by = (select auth.uid())
  and exists (
    select 1
    from public.customer_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.account_state = 'active'
  )
  and (
    ask_psi_conversations.vehicle_id is null
    or exists (
      select 1
      from public.customer_vehicles vehicle
      where vehicle.id = ask_psi_conversations.vehicle_id
        and vehicle.customer_id = (select auth.uid())
        and vehicle.archived_at is null
    )
  )
  and (
    ask_psi_conversations.booking_request_id is null
    or exists (
      select 1
      from public.booking_requests booking
      where booking.id = ask_psi_conversations.booking_request_id
        and booking.customer_id = (select auth.uid())
    )
  )
);

create policy ask_psi_conversations_staff_update
on public.ask_psi_conversations for update to authenticated
using ((select private.is_active_staff()))
with check (
  (select private.is_active_staff())
  and (
    ask_psi_conversations.assigned_staff_id is null
    or exists (
      select 1
      from public.staff_members staff
      where staff.user_id = ask_psi_conversations.assigned_staff_id
        and staff.status = 'active'
    )
  )
);

create policy ask_psi_messages_participant_select
on public.ask_psi_messages for select to authenticated
using (
  exists (
    select 1
    from public.ask_psi_conversations conversation
    where conversation.id = ask_psi_messages.conversation_id
      and (
        conversation.customer_id = (select auth.uid())
        or (select private.is_active_staff())
      )
  )
);

create policy ask_psi_messages_participant_insert
on public.ask_psi_messages for insert to authenticated
with check (
  ask_psi_messages.sender_user_id = (select auth.uid())
  and (
    (
      ask_psi_messages.sender_kind = 'customer'
      and exists (
        select 1
        from public.ask_psi_conversations conversation
        where conversation.id = ask_psi_messages.conversation_id
          and conversation.customer_id = (select auth.uid())
      )
    )
    or (
      ask_psi_messages.sender_kind = 'staff'
      and (select private.is_active_staff())
      and exists (
        select 1
        from public.ask_psi_conversations conversation
        where conversation.id = ask_psi_messages.conversation_id
      )
    )
  )
);

create policy ask_psi_attachments_participant_select
on public.ask_psi_attachments for select to authenticated
using (
  exists (
    select 1
    from public.ask_psi_messages message
    join public.ask_psi_conversations conversation on conversation.id = message.conversation_id
    where message.id = ask_psi_attachments.message_id
      and (
        conversation.customer_id = (select auth.uid())
        or (select private.is_active_staff())
      )
  )
);

create policy ask_psi_attachments_participant_insert
on public.ask_psi_attachments for insert to authenticated
with check (
  ask_psi_attachments.created_by = (select auth.uid())
  and exists (
    select 1
    from public.ask_psi_messages message
    join public.ask_psi_conversations conversation on conversation.id = message.conversation_id
    where message.id = ask_psi_attachments.message_id
      and message.sender_user_id = (select auth.uid())
      and (
        conversation.customer_id = (select auth.uid())
        or (select private.is_active_staff())
      )
      and ask_psi_attachments.object_path = conversation.customer_id::text || '/' || conversation.id::text || '/' || message.id::text || '/' || (storage.filename(ask_psi_attachments.object_path))
  )
);

create policy ask_psi_email_jobs_staff_select
on public.ask_psi_email_jobs for select to authenticated
using ((select private.is_active_staff()));

revoke all on public.ask_psi_conversations from public, anon, authenticated;
revoke all on public.ask_psi_messages from public, anon, authenticated;
revoke all on public.ask_psi_attachments from public, anon, authenticated;
revoke all on public.ask_psi_email_jobs from public, anon, authenticated;

grant select on public.ask_psi_conversations to authenticated;
grant insert (customer_id, vehicle_id, booking_request_id, topic, created_by)
on public.ask_psi_conversations to authenticated;
grant update (status, assigned_staff_id, closed_at, updated_at)
on public.ask_psi_conversations to authenticated;

grant select on public.ask_psi_messages to authenticated;
grant insert (conversation_id, sender_user_id, sender_kind, message_kind, body, client_nonce)
on public.ask_psi_messages to authenticated;

grant select on public.ask_psi_attachments to authenticated;
grant insert (message_id, bucket_id, object_path, mime_type, file_size_bytes, width, height, created_by)
on public.ask_psi_attachments to authenticated;

grant select on public.ask_psi_email_jobs to authenticated;
grant select, insert, update, delete on public.ask_psi_conversations to service_role;
grant select, insert, update, delete on public.ask_psi_messages to service_role;
grant select, insert, update, delete on public.ask_psi_attachments to service_role;
grant select, insert, update, delete on public.ask_psi_email_jobs to service_role;

create trigger ask_psi_conversations_set_updated_at
before update on public.ask_psi_conversations
for each row execute function private.set_updated_at();

create trigger ask_psi_email_jobs_set_updated_at
before update on public.ask_psi_email_jobs
for each row execute function private.set_updated_at();

create or replace function private.validate_ask_psi_conversation_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1
    from public.customer_vehicles vehicle
    where vehicle.id = new.vehicle_id
      and vehicle.customer_id = new.customer_id
      and vehicle.archived_at is null
  ) then
    raise exception 'ask_psi_vehicle_customer_mismatch' using errcode = '23514';
  end if;

  if new.booking_request_id is not null and not exists (
    select 1
    from public.booking_requests booking
    where booking.id = new.booking_request_id
      and booking.customer_id = new.customer_id
      and (new.vehicle_id is null or booking.vehicle_id = new.vehicle_id)
  ) then
    raise exception 'ask_psi_booking_customer_mismatch' using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function private.validate_ask_psi_conversation_links()
from public, anon, authenticated, service_role;

create trigger validate_ask_psi_conversation_links
before insert or update of customer_id, vehicle_id, booking_request_id
on public.ask_psi_conversations
for each row execute function private.validate_ask_psi_conversation_links();

create or replace function public.open_ask_psi_conversation(
  p_vehicle_id uuid,
  p_booking_request_id uuid,
  p_topic text,
  p_body text,
  p_client_nonce uuid
)
returns table (conversation_id uuid, message_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  created_conversation_id uuid;
  created_message_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_topic not in (
    'service', 'booking', 'vehicle_fault', 'dyno', 'records',
    'performance_build', 'sell_my_car', 'other'
  ) then
    raise exception 'invalid_ask_psi_topic' using errcode = '22023';
  end if;

  if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'invalid_ask_psi_message' using errcode = '22023';
  end if;

  if p_client_nonce is null then
    raise exception 'ask_psi_client_nonce_required' using errcode = '22023';
  end if;

  insert into public.ask_psi_conversations (
    customer_id,
    vehicle_id,
    booking_request_id,
    topic,
    created_by
  ) values (
    actor_id,
    p_vehicle_id,
    p_booking_request_id,
    p_topic,
    actor_id
  )
  returning id into created_conversation_id;

  insert into public.ask_psi_messages (
    conversation_id,
    sender_user_id,
    sender_kind,
    message_kind,
    body,
    client_nonce
  ) values (
    created_conversation_id,
    actor_id,
    'customer',
    'text',
    btrim(p_body),
    p_client_nonce
  )
  returning id into created_message_id;

  return query select created_conversation_id, created_message_id;
end
$$;

revoke all on function public.open_ask_psi_conversation(uuid, uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.open_ask_psi_conversation(uuid, uuid, text, text, uuid)
to authenticated;

create or replace function public.send_ask_psi_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce uuid,
  p_message_kind text default 'text'
)
returns public.ask_psi_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_kind text;
  created_message public.ask_psi_messages;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_message_kind not in ('text', 'photo') then
    raise exception 'invalid_ask_psi_message_kind' using errcode = '22023';
  end if;

  if p_message_kind = 'text' and (p_body is null or char_length(btrim(p_body)) not between 1 and 4000) then
    raise exception 'invalid_ask_psi_message' using errcode = '22023';
  end if;

  if p_message_kind = 'photo' and p_body is not null and char_length(btrim(p_body)) not between 1 and 1000 then
    raise exception 'invalid_ask_psi_photo_caption' using errcode = '22023';
  end if;

  if p_client_nonce is null then
    raise exception 'ask_psi_client_nonce_required' using errcode = '22023';
  end if;

  actor_kind := case
    when (select private.is_active_staff()) then 'staff'
    else 'customer'
  end;

  insert into public.ask_psi_messages (
    conversation_id,
    sender_user_id,
    sender_kind,
    message_kind,
    body,
    client_nonce
  ) values (
    p_conversation_id,
    actor_id,
    actor_kind,
    p_message_kind,
    nullif(btrim(coalesce(p_body, '')), ''),
    p_client_nonce
  )
  returning * into created_message;

  return created_message;
end
$$;

revoke all on function public.send_ask_psi_message(uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.send_ask_psi_message(uuid, text, uuid, text)
to authenticated;

create or replace function public.mark_ask_psi_conversation_read(
  p_conversation_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  marked_at timestamptz := now();
  is_staff boolean;
  target_customer_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select conversation.customer_id
  into target_customer_id
  from public.ask_psi_conversations conversation
  where conversation.id = p_conversation_id;

  if target_customer_id is null then
    raise exception 'ask_psi_conversation_not_found' using errcode = 'P0002';
  end if;

  is_staff := (select private.is_active_staff());
  if not is_staff and target_customer_id <> actor_id then
    raise exception 'ask_psi_conversation_access_denied' using errcode = '42501';
  end if;

  if is_staff then
    update public.ask_psi_conversations
    set staff_last_read_at = greatest(coalesce(staff_last_read_at, '-infinity'::timestamptz), marked_at),
        updated_at = now()
    where id = p_conversation_id;

    update public.ask_psi_email_jobs job
    set status = 'cancelled',
        completed_at = marked_at,
        last_error_code = 'read_before_email_fallback',
        updated_at = marked_at
    from public.ask_psi_messages message
    where job.message_id = message.id
      and job.conversation_id = p_conversation_id
      and message.sender_kind = 'customer'
      and message.created_at <= marked_at
      and job.status in ('pending', 'failed', 'blocked_configuration');
  else
    update public.ask_psi_conversations
    set customer_last_read_at = greatest(coalesce(customer_last_read_at, '-infinity'::timestamptz), marked_at),
        updated_at = now()
    where id = p_conversation_id;
  end if;

  return marked_at;
end
$$;

revoke all on function public.mark_ask_psi_conversation_read(uuid)
from public, anon, authenticated;
grant execute on function public.mark_ask_psi_conversation_read(uuid)
to authenticated;

create or replace function public.set_ask_psi_conversation_status(
  p_conversation_id uuid,
  p_status text,
  p_assign_to_self boolean default false
)
returns public.ask_psi_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  updated_conversation public.ask_psi_conversations;
begin
  if actor_id is null or not (select private.is_active_staff()) then
    raise exception 'staff_aal2_required' using errcode = '42501';
  end if;

  if p_status not in ('open', 'awaiting_psi', 'awaiting_customer', 'closed') then
    raise exception 'invalid_ask_psi_status' using errcode = '22023';
  end if;

  update public.ask_psi_conversations
  set status = p_status,
      assigned_staff_id = case when p_assign_to_self then actor_id else assigned_staff_id end,
      closed_at = case when p_status = 'closed' then now() else null end,
      updated_at = now()
  where id = p_conversation_id
  returning * into updated_conversation;

  if updated_conversation.id is null then
    raise exception 'ask_psi_conversation_not_found' using errcode = 'P0002';
  end if;

  return updated_conversation;
end
$$;

revoke all on function public.set_ask_psi_conversation_status(uuid, text, boolean)
from public, anon, authenticated;
grant execute on function public.set_ask_psi_conversation_status(uuid, text, boolean)
to authenticated;

alter table public.notification_preferences
  add column message_alerts_enabled boolean not null default true,
  add column message_email_fallback_enabled boolean not null default true;

grant update (message_alerts_enabled, message_email_fallback_enabled)
on public.notification_preferences to authenticated;

alter table public.notification_events
  add column ask_psi_conversation_id uuid references public.ask_psi_conversations(id) on delete cascade;

alter table public.push_notification_jobs
  add column ask_psi_conversation_id uuid references public.ask_psi_conversations(id) on delete cascade;

create index notification_events_ask_psi_conversation_idx
on public.notification_events (ask_psi_conversation_id, created_at desc)
where ask_psi_conversation_id is not null;

create index push_notification_jobs_ask_psi_conversation_idx
on public.push_notification_jobs (ask_psi_conversation_id, status, created_at)
where ask_psi_conversation_id is not null;

alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check check (kind in (
    'booking_request_received',
    'new_booking_request',
    'booking_date_proposed',
    'booking_date_approved',
    'booking_cancelled',
    'booking_confirmed',
    'booking_completed',
    'psi_event_published',
    'psi_event_updated',
    'psi_event_cancelled',
    'service_reminder',
    'xero_invoice_review',
    'car_sale_published',
    'performance_subscription_started',
    'customer_message_received',
    'staff_message_received'
  ));

alter table public.notification_events
  drop constraint if exists notification_events_deep_link_check;

alter table public.notification_events
  add constraint notification_events_deep_link_check check (
    deep_link in ('/booking', '/bookings', '/staff', '/events', '/customer-cars-for-sale', '/messages')
  );

create or replace function private.queue_ask_psi_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.ask_psi_conversations;
  recipient_id uuid;
  created_event_id uuid;
  customer_display text;
  registration_display text;
begin
  select * into conversation
  from public.ask_psi_conversations
  where id = new.conversation_id;

  if conversation.id is null then
    raise exception 'ask_psi_conversation_not_found' using errcode = 'P0002';
  end if;

  update public.ask_psi_conversations
  set status = case
        when new.sender_kind = 'customer' then 'awaiting_psi'
        when new.sender_kind in ('staff', 'assistant') then 'awaiting_customer'
        else status
      end,
      closed_at = null,
      customer_last_read_at = case
        when new.sender_kind = 'customer' then new.created_at
        else customer_last_read_at
      end,
      staff_last_read_at = case
        when new.sender_kind = 'staff' then new.created_at
        else staff_last_read_at
      end,
      last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;

  if new.sender_kind = 'customer' then
    select coalesce(
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      profile.email,
      'Customer'
    ) into customer_display
    from public.customer_profiles profile
    where profile.user_id = conversation.customer_id;

    select vehicle.registration into registration_display
    from public.customer_vehicles vehicle
    where vehicle.id = conversation.vehicle_id;

    for recipient_id in
      select staff.user_id
      from public.staff_members staff
      where staff.status = 'active'
        and staff.user_id is not null
    loop
      insert into public.notification_events (
        recipient_user_id,
        booking_request_id,
        ask_psi_conversation_id,
        kind,
        title,
        body,
        deep_link,
        source_event_key
      ) values (
        recipient_id,
        conversation.booking_request_id,
        conversation.id,
        'customer_message_received',
        'New customer message',
        left(customer_display || coalesce(' · ' || registration_display, '') || ' sent PSI a message.', 240),
        '/staff',
        'ask_psi_message:' || new.id::text || ':' || recipient_id::text
      )
      on conflict (source_event_key) do nothing
      returning id into created_event_id;

      if created_event_id is not null then
        insert into public.push_notification_jobs (
          event_id,
          booking_request_id,
          ask_psi_conversation_id,
          recipient_user_id
        ) values (
          created_event_id,
          conversation.booking_request_id,
          conversation.id,
          recipient_id
        );
      end if;

      if exists (
        select 1
        from public.staff_members staff
        left join public.notification_preferences preference on preference.user_id = staff.user_id
        where staff.user_id = recipient_id
          and staff.role = 'owner'
          and staff.status = 'active'
          and coalesce(preference.message_email_fallback_enabled, true)
      ) then
        insert into public.ask_psi_email_jobs (
          conversation_id,
          message_id,
          recipient_user_id
        ) values (
          conversation.id,
          new.id,
          recipient_id
        )
        on conflict (message_id, recipient_user_id) do nothing;
      end if;

      created_event_id := null;
    end loop;
  elsif new.sender_kind in ('staff', 'assistant') then
    insert into public.notification_events (
      recipient_user_id,
      booking_request_id,
      ask_psi_conversation_id,
      kind,
      title,
      body,
      deep_link,
      source_event_key
    ) values (
      conversation.customer_id,
      conversation.booking_request_id,
      conversation.id,
      'staff_message_received',
      'New message from PSI',
      'PSI replied to your private conversation.',
      '/messages',
      'ask_psi_message:' || new.id::text || ':' || conversation.customer_id::text
    )
    on conflict (source_event_key) do nothing
    returning id into created_event_id;

    if created_event_id is not null then
      insert into public.push_notification_jobs (
        event_id,
        booking_request_id,
        ask_psi_conversation_id,
        recipient_user_id
      ) values (
        created_event_id,
        conversation.booking_request_id,
        conversation.id,
        conversation.customer_id
      );
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.queue_ask_psi_message_notifications()
from public, anon, authenticated, service_role;

create trigger queue_ask_psi_message_notifications
after insert on public.ask_psi_messages
for each row execute function private.queue_ask_psi_message_notifications();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ask-psi-media',
  'ask-psi-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy ask_psi_media_participant_select
on storage.objects for select to authenticated
using (
  bucket_id = 'ask-psi-media'
  and exists (
    select 1
    from public.ask_psi_attachments attachment
    join public.ask_psi_messages message on message.id = attachment.message_id
    join public.ask_psi_conversations conversation on conversation.id = message.conversation_id
    where attachment.bucket_id = storage.objects.bucket_id
      and attachment.object_path = storage.objects.name
      and (
        conversation.customer_id = (select auth.uid())
        or (select private.is_active_staff())
      )
  )
);

create policy ask_psi_media_customer_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ask-psi-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.ask_psi_conversations conversation
    where conversation.id::text = (storage.foldername(name))[2]
      and conversation.customer_id = (select auth.uid())
  )
);

create policy ask_psi_media_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ask-psi-media'
  and (select private.is_active_staff())
  and exists (
    select 1
    from public.ask_psi_conversations conversation
    where conversation.customer_id::text = (storage.foldername(name))[1]
      and conversation.id::text = (storage.foldername(name))[2]
  )
);

alter publication supabase_realtime add table public.ask_psi_conversations;
alter publication supabase_realtime add table public.ask_psi_messages;
