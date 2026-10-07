-- Private Ask PSI correctness fixes. Apply to the isolated review project only
-- until the owner approves a production release.

grant insert (id) on public.ask_psi_messages to authenticated;

alter table public.ask_psi_messages
  add column recipient_read_at timestamptz;
alter table public.ask_psi_messages alter column created_at set default clock_timestamp();

create unique index ask_psi_messages_sender_nonce_unique_idx
on public.ask_psi_messages (sender_user_id, client_nonce)
where sender_user_id is not null and client_nonce is not null;

-- The uploader must be able to find an unregistered object to clean it up.
-- Once registered, normal conversation participant policies control access.
create policy ask_psi_media_unregistered_uploader_select
on storage.objects for select to authenticated
using (
  bucket_id = 'ask-psi-media'
  and owner_id = (select auth.uid())::text
  and not exists (
    select 1 from public.ask_psi_attachments attachment
    where attachment.bucket_id = storage.objects.bucket_id
      and attachment.object_path = storage.objects.name
  )
  and exists (
    select 1 from public.ask_psi_conversations conversation
    where conversation.customer_id::text = (storage.foldername(name))[1]
      and conversation.id::text = (storage.foldername(name))[2]
      and (conversation.customer_id = (select auth.uid()) or (select private.is_active_staff()))
  )
);

-- A signed upload is not evidence that a later registration request names the
-- right object. Validate the real object and prevent invented attachments.
create or replace function private.validate_ask_psi_attachment_object()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from storage.objects object
    join public.ask_psi_messages message on message.id = new.message_id
    where object.bucket_id = new.bucket_id
      and object.name = new.object_path
      and object.owner_id = new.created_by::text
      and message.sender_user_id = new.created_by
      and message.message_kind = 'photo'
      and (object.metadata ->> 'mimetype') = new.mime_type
      and (object.metadata ->> 'size')::bigint = new.file_size_bytes
  ) then
    raise exception 'ask_psi_photo_upload_not_verified' using errcode = '23514';
  end if;
  return new;
end
$$;
revoke all on function private.validate_ask_psi_attachment_object() from public, anon, authenticated, service_role;
create trigger validate_ask_psi_attachment_object
before insert on public.ask_psi_attachments
for each row execute function private.validate_ask_psi_attachment_object();

create or replace function public.open_ask_psi_conversation(
  p_vehicle_id uuid, p_booking_request_id uuid, p_topic text, p_body text, p_client_nonce uuid
)
returns table (conversation_id uuid, message_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  existing_message public.ask_psi_messages;
  existing_conversation public.ask_psi_conversations;
  created_conversation_id uuid;
  created_message_id uuid;
begin
  if actor_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_client_nonce is null then raise exception 'ask_psi_client_nonce_required' using errcode = '22023'; end if;
  if p_topic is null or p_topic not in ('service','booking','vehicle_fault','dyno','records','performance_build','sell_my_car','other') then
    raise exception 'invalid_ask_psi_topic' using errcode = '22023';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'invalid_ask_psi_message' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || p_client_nonce::text, 0));
  select * into existing_message from public.ask_psi_messages
  where sender_user_id = actor_id and client_nonce = p_client_nonce;
  if existing_message.id is not null then
    select * into existing_conversation from public.ask_psi_conversations where id = existing_message.conversation_id;
    if existing_message.sender_kind <> 'customer' or existing_message.message_kind <> 'text'
      or existing_message.body is distinct from btrim(p_body)
      or existing_conversation.topic is distinct from p_topic
      or existing_conversation.vehicle_id is distinct from p_vehicle_id
      or existing_conversation.booking_request_id is distinct from p_booking_request_id then
      raise exception 'ask_psi_nonce_content_conflict' using errcode = '22023';
    end if;
    return query select existing_conversation.id, existing_message.id;
    return;
  end if;
  insert into public.ask_psi_conversations (customer_id, vehicle_id, booking_request_id, topic, created_by)
  values (actor_id, p_vehicle_id, p_booking_request_id, p_topic, actor_id)
  returning id into created_conversation_id;
  insert into public.ask_psi_messages (conversation_id, sender_user_id, sender_kind, message_kind, body, client_nonce)
  values (created_conversation_id, actor_id, 'customer', 'text', btrim(p_body), p_client_nonce)
  returning id into created_message_id;
  return query select created_conversation_id, created_message_id;
end
$$;

create or replace function public.send_ask_psi_message(
  p_conversation_id uuid, p_body text, p_client_nonce uuid, p_message_kind text default 'text'
)
returns public.ask_psi_messages
language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  actor_kind text;
  result public.ask_psi_messages;
begin
  if actor_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_client_nonce is null then raise exception 'ask_psi_client_nonce_required' using errcode = '22023'; end if;
  -- Photos have a separate atomic registration function.
  if p_message_kind is distinct from 'text' then raise exception 'invalid_ask_psi_message_kind' using errcode = '22023'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'invalid_ask_psi_message' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || p_client_nonce::text, 0));
  select * into result from public.ask_psi_messages where sender_user_id = actor_id and client_nonce = p_client_nonce;
  if result.id is not null then
    if result.conversation_id is distinct from p_conversation_id or result.message_kind <> 'text'
      or result.body is distinct from btrim(p_body) then
      raise exception 'ask_psi_nonce_content_conflict' using errcode = '22023';
    end if;
    return result;
  end if;
  actor_kind := case when (select private.is_active_staff()) then 'staff' else 'customer' end;
  insert into public.ask_psi_messages (conversation_id, sender_user_id, sender_kind, message_kind, body, client_nonce)
  values (p_conversation_id, actor_id, actor_kind, 'text', btrim(p_body), p_client_nonce)
  returning * into result;
  return result;
end
$$;

create or replace function public.send_ask_psi_photo(
  p_conversation_id uuid, p_message_id uuid, p_caption text, p_client_nonce uuid,
  p_object_path text, p_mime_type text, p_file_size_bytes bigint,
  p_width integer default null, p_height integer default null
)
returns public.ask_psi_messages
language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  actor_kind text;
  conversation public.ask_psi_conversations;
  result public.ask_psi_messages;
begin
  if actor_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_message_id is null or p_client_nonce is null then raise exception 'ask_psi_photo_identifiers_required' using errcode = '22023'; end if;
  if p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'ask_psi_photo_type_unsupported' using errcode = '22023'; end if;
  if p_file_size_bytes is null or p_file_size_bytes not between 1 and 10485760 then raise exception 'ask_psi_photo_size_invalid' using errcode = '22023'; end if;
  if p_width is not null and p_width not between 1 and 12000 then raise exception 'ask_psi_photo_width_invalid' using errcode = '22023'; end if;
  if p_height is not null and p_height not between 1 and 12000 then raise exception 'ask_psi_photo_height_invalid' using errcode = '22023'; end if;
  if p_caption is not null and char_length(btrim(p_caption)) not between 1 and 1000 then raise exception 'invalid_ask_psi_photo_caption' using errcode = '22023'; end if;
  select * into conversation from public.ask_psi_conversations where id = p_conversation_id;
  if conversation.id is null then raise exception 'ask_psi_conversation_not_found' using errcode = '42501'; end if;
  if p_object_path is null
    or split_part(p_object_path,'/',1) <> conversation.customer_id::text
    or split_part(p_object_path,'/',2) <> conversation.id::text
    or split_part(p_object_path,'/',3) <> p_message_id::text
    or split_part(p_object_path,'/',4) = '' or split_part(p_object_path,'/',5) <> '' then
    raise exception 'ask_psi_photo_path_invalid' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || p_client_nonce::text, 0));
  select * into result from public.ask_psi_messages where sender_user_id = actor_id and client_nonce = p_client_nonce;
  if result.id is not null then
    if result.id <> p_message_id or result.conversation_id <> p_conversation_id or result.message_kind <> 'photo'
      or result.body is distinct from nullif(btrim(coalesce(p_caption,'')), '')
      or not exists (
        select 1 from public.ask_psi_attachments attachment where attachment.message_id = result.id
          and attachment.object_path = p_object_path and attachment.mime_type = p_mime_type
          and attachment.file_size_bytes = p_file_size_bytes
          and attachment.width is not distinct from p_width and attachment.height is not distinct from p_height
      ) then raise exception 'ask_psi_nonce_content_conflict' using errcode = '22023'; end if;
    return result;
  end if;
  actor_kind := case when (select private.is_active_staff()) then 'staff' else 'customer' end;
  insert into public.ask_psi_messages (id,conversation_id,sender_user_id,sender_kind,message_kind,body,client_nonce)
  values (p_message_id,p_conversation_id,actor_id,actor_kind,'photo',nullif(btrim(coalesce(p_caption,'')),''),p_client_nonce)
  returning * into result;
  insert into public.ask_psi_attachments (message_id,object_path,mime_type,file_size_bytes,width,height,created_by)
  values (result.id,p_object_path,p_mime_type,p_file_size_bytes,p_width,p_height,actor_id);
  return result;
end
$$;

drop function public.mark_ask_psi_conversation_read(uuid);
create function public.mark_ask_psi_conversation_read(p_conversation_id uuid, p_read_through_message_id uuid default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  is_staff boolean;
  target public.ask_psi_conversations;
  read_through public.ask_psi_messages;
  marked_at timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target from public.ask_psi_conversations where id = p_conversation_id for update;
  is_staff := (select private.is_active_staff());
  if target.id is null or (not is_staff and target.customer_id <> actor_id) then
    raise exception 'ask_psi_conversation_access_denied' using errcode = '42501';
  end if;
  if p_read_through_message_id is null then
    return case when is_staff then target.staff_last_read_at else target.customer_last_read_at end;
  end if;
  select * into read_through from public.ask_psi_messages
  where id = p_read_through_message_id and conversation_id = p_conversation_id
    and ((is_staff and sender_kind = 'customer') or (not is_staff and sender_kind in ('staff','assistant')));
  if read_through.id is null then raise exception 'ask_psi_read_message_invalid' using errcode = '22023'; end if;

  update public.ask_psi_messages message set recipient_read_at = marked_at
  where message.conversation_id = p_conversation_id and message.recipient_read_at is null
    and (message.created_at,message.id) <= (read_through.created_at,read_through.id)
    and ((is_staff and message.sender_kind = 'customer') or (not is_staff and message.sender_kind in ('staff','assistant')));
  update public.ask_psi_conversations
  set staff_last_read_at = case when is_staff then greatest(coalesce(staff_last_read_at,'-infinity'::timestamptz),read_through.created_at) else staff_last_read_at end,
      customer_last_read_at = case when not is_staff then greatest(coalesce(customer_last_read_at,'-infinity'::timestamptz),read_through.created_at) else customer_last_read_at end
  where id = p_conversation_id;

  update public.notification_events event set read_at = coalesce(event.read_at,marked_at)
  from public.ask_psi_messages message
  where message.conversation_id = p_conversation_id and message.recipient_read_at is not null
    and ((is_staff and message.sender_kind = 'customer') or (not is_staff and message.sender_kind in ('staff','assistant')))
    and event.ask_psi_conversation_id = p_conversation_id
    and event.source_event_key = 'ask_psi_message:' || message.id::text || ':' || event.recipient_user_id::text;
  update public.push_notification_jobs job set status = 'cancelled',completed_at = marked_at,last_error_code = 'message_already_read',updated_at = marked_at
  from public.notification_events event
  where job.event_id = event.id and event.ask_psi_conversation_id = p_conversation_id and event.read_at is not null
    and job.status in ('pending','failed');
  if is_staff then
    update public.ask_psi_email_jobs job set status = 'cancelled',completed_at = marked_at,last_error_code = 'read_before_email_fallback',updated_at = marked_at
    from public.ask_psi_messages message
    where job.message_id = message.id and message.conversation_id = p_conversation_id
      and message.sender_kind = 'customer' and message.recipient_read_at is not null
      and job.status in ('pending','failed','blocked_configuration');
  end if;
  return marked_at;
end
$$;
revoke all on function public.mark_ask_psi_conversation_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_ask_psi_conversation_read(uuid,uuid) to authenticated;

-- Sending a message is not proof that earlier incoming messages were read.
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
      last_message_at = greatest(last_message_at, new.created_at),
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
