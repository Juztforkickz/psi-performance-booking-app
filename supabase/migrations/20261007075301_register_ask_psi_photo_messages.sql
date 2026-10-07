-- Register an uploaded Ask PSI photo and its message in one transaction.
-- The storage upload happens first through participant scoped bucket policies.

create or replace function public.send_ask_psi_photo(
  p_conversation_id uuid,
  p_message_id uuid,
  p_caption text,
  p_client_nonce uuid,
  p_object_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_width integer default null,
  p_height integer default null
)
returns public.ask_psi_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_kind text;
  conversation public.ask_psi_conversations;
  created_message public.ask_psi_messages;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_message_id is null or p_client_nonce is null then
    raise exception 'ask_psi_photo_identifiers_required' using errcode = '22023';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'ask_psi_photo_type_unsupported' using errcode = '22023';
  end if;

  if p_file_size_bytes not between 1 and 10485760 then
    raise exception 'ask_psi_photo_size_invalid' using errcode = '22023';
  end if;

  if p_width is not null and p_width not between 1 and 12000 then
    raise exception 'ask_psi_photo_width_invalid' using errcode = '22023';
  end if;

  if p_height is not null and p_height not between 1 and 12000 then
    raise exception 'ask_psi_photo_height_invalid' using errcode = '22023';
  end if;

  if p_caption is not null and char_length(btrim(p_caption)) not between 1 and 1000 then
    raise exception 'invalid_ask_psi_photo_caption' using errcode = '22023';
  end if;

  select * into conversation
  from public.ask_psi_conversations
  where id = p_conversation_id;

  if conversation.id is null then
    raise exception 'ask_psi_conversation_not_found' using errcode = 'P0002';
  end if;

  if p_object_path is null
    or split_part(p_object_path, '/', 1) <> conversation.customer_id::text
    or split_part(p_object_path, '/', 2) <> conversation.id::text
    or split_part(p_object_path, '/', 3) <> p_message_id::text
    or split_part(p_object_path, '/', 4) = ''
    or split_part(p_object_path, '/', 5) <> '' then
    raise exception 'ask_psi_photo_path_invalid' using errcode = '22023';
  end if;

  actor_kind := case
    when (select private.is_active_staff()) then 'staff'
    else 'customer'
  end;

  insert into public.ask_psi_messages (
    id,
    conversation_id,
    sender_user_id,
    sender_kind,
    message_kind,
    body,
    client_nonce
  ) values (
    p_message_id,
    p_conversation_id,
    actor_id,
    actor_kind,
    'photo',
    nullif(btrim(coalesce(p_caption, '')), ''),
    p_client_nonce
  )
  returning * into created_message;

  insert into public.ask_psi_attachments (
    message_id,
    object_path,
    mime_type,
    file_size_bytes,
    width,
    height,
    created_by
  ) values (
    created_message.id,
    p_object_path,
    p_mime_type,
    p_file_size_bytes,
    p_width,
    p_height,
    actor_id
  );

  return created_message;
end
$$;

revoke all on function public.send_ask_psi_photo(uuid, uuid, text, uuid, text, text, bigint, integer, integer)
from public, anon, authenticated;
grant execute on function public.send_ask_psi_photo(uuid, uuid, text, uuid, text, text, bigint, integer, integer)
to authenticated;

create policy ask_psi_media_failed_upload_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'ask-psi-media'
  and not exists (
    select 1
    from public.ask_psi_attachments attachment
    where attachment.bucket_id = storage.objects.bucket_id
      and attachment.object_path = storage.objects.name
  )
  and (
    (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.ask_psi_conversations conversation
        where conversation.id::text = (storage.foldername(name))[2]
          and conversation.customer_id = (select auth.uid())
      )
    )
    or (
      (select private.is_active_staff())
      and exists (
        select 1
        from public.ask_psi_conversations conversation
        where conversation.customer_id::text = (storage.foldername(name))[1]
          and conversation.id::text = (storage.foldername(name))[2]
      )
    )
  )
);
