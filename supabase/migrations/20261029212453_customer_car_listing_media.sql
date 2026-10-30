-- Sale attachments never reuse a customer's private workshop bucket or records.
create table if not exists public.customer_car_listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.customer_car_listings(id) on delete restrict,
  object_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 200),
  mime_type text not null,
  kind text not null check (kind in ('photo', 'video', 'file')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'pending' check (state in ('pending', 'ready', 'removed')),
  is_cover boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, sha256),
  check (not is_cover or (kind = 'photo' and state = 'ready')),
  check (object_path like listing_id::text || '/' || id::text || '.%'),
  check (
    (kind = 'photo' and mime_type = 'image/jpeg' and size_bytes <= 10485760)
    or (kind = 'video' and mime_type in ('video/mp4', 'video/quicktime', 'video/webm'))
    or (kind = 'file' and size_bytes <= 20971520 and mime_type in (
      'application/pdf', 'text/plain', 'text/csv', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ))
  )
);
create index if not exists customer_car_listing_media_creator_idx on public.customer_car_listing_media(created_by);
create unique index if not exists customer_car_listing_media_cover_idx
  on public.customer_car_listing_media(listing_id) where is_cover;
alter table public.customer_car_listing_media enable row level security;
revoke all on public.customer_car_listing_media from public, anon, authenticated;
grant select on public.customer_car_listing_media to authenticated;
grant all on public.customer_car_listing_media to service_role;

create or replace function private.can_read_car_listing_media(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.customer_car_listing_media m
    join public.customer_car_listings l on l.id = m.listing_id
    where m.object_path = p_path and (
      (select private.is_active_staff()) or (
        m.state = 'ready' and l.status in ('published', 'under_offer')
        and (select private.customer_identity_access_allowed())
      )
    )
  );
$$;
create or replace function private.can_upload_car_listing_media(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (select auth.jwt()->>'aal') = 'aal2' and (select private.is_active_staff()) and exists (
    select 1 from public.customer_car_listing_media m
    join public.customer_car_listings l on l.id = m.listing_id
    where m.object_path = p_path and m.state = 'pending' and l.status in ('draft', 'published', 'under_offer')
  );
$$;
revoke all on function private.can_read_car_listing_media(text), private.can_upload_car_listing_media(text) from public, anon;
grant execute on function private.can_read_car_listing_media(text), private.can_upload_car_listing_media(text) to authenticated;
drop policy if exists "read permitted sale attachment metadata" on public.customer_car_listing_media;
create policy "read permitted sale attachment metadata" on public.customer_car_listing_media
  for select to authenticated using (private.can_read_car_listing_media(object_path));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('car-listing-media','car-listing-media',false,52428800,array[
  'image/jpeg','video/mp4','video/quicktime','video/webm','application/pdf','text/plain','text/csv','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]) on conflict (id) do nothing;

-- Restrictive boundaries also prevent any unrelated permissive storage policy
-- from exposing, replacing or deleting these immutable attachment objects.
drop policy if exists "sale attachment read boundary" on storage.objects;
create policy "sale attachment read boundary" on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'car-listing-media' or private.can_read_car_listing_media(name));
drop policy if exists "read sale attachment objects" on storage.objects;
create policy "read sale attachment objects" on storage.objects for select to authenticated
  using (bucket_id = 'car-listing-media' and private.can_read_car_listing_media(name));
drop policy if exists "sale attachment upload boundary" on storage.objects;
create policy "sale attachment upload boundary" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'car-listing-media' or private.can_upload_car_listing_media(name));
drop policy if exists "upload reserved sale attachments" on storage.objects;
create policy "upload reserved sale attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-listing-media' and private.can_upload_car_listing_media(name));
drop policy if exists "sale attachments are immutable" on storage.objects;
create policy "sale attachments are immutable" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'car-listing-media') with check (bucket_id <> 'car-listing-media');
drop policy if exists "sale attachment objects retained" on storage.objects;
create policy "sale attachment objects retained" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'car-listing-media');

create or replace function private.manage_car_listing_media(
  p_action text, p_listing_id uuid, p_media_id uuid default null, p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_listing public.customer_car_listings;
  v_media public.customer_car_listing_media;
  v_type text; v_kind text; v_ext text; v_size bigint; v_sha text; v_name text;
  v_object storage.objects;
begin
  if (select auth.uid()) is null or (select auth.jwt()->>'aal') is distinct from 'aal2' or not (select private.is_active_staff()) then
    raise exception 'STAFF_AAL2_REQUIRED' using errcode = '42501';
  end if;
  select * into v_listing from public.customer_car_listings where id = p_listing_id for update;
  if not found or v_listing.status not in ('draft','published','under_offer') then
    raise exception 'CAR_MEDIA_LISTING_UNAVAILABLE';
  end if;
  if p_action = 'reserve' then
    v_type := p_metadata->>'mime_type'; v_sha := p_metadata->>'sha256';
    v_name := btrim(p_metadata->>'filename');
    if coalesce(p_metadata->>'size_bytes','') !~ '^[0-9]{1,9}$' then raise exception 'CAR_MEDIA_SIZE_INVALID'; end if;
    v_size := (p_metadata->>'size_bytes')::bigint;
    if v_name is null or char_length(v_name) not between 1 and 200
      or v_name ~ '[[:cntrl:]]' or v_sha is null or v_sha !~ '^[0-9a-f]{64}$' then
      raise exception 'CAR_MEDIA_METADATA_INVALID';
    end if;
    select x.kind,x.ext into v_kind,v_ext from (values
      ('image/jpeg','photo','jpg'),('video/mp4','video','mp4'),('video/quicktime','video','mov'),('video/webm','video','webm'),
      ('application/pdf','file','pdf'),('text/plain','file','txt'),('text/csv','file','csv'),('application/msword','file','doc'),
      ('application/vnd.openxmlformats-officedocument.wordprocessingml.document','file','docx'),
      ('application/vnd.ms-excel','file','xls'),('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','file','xlsx')
    ) x(mime,kind,ext) where x.mime = v_type;
    if v_kind is null then raise exception 'CAR_MEDIA_TYPE_INVALID'; end if;
    if v_size < 1 or v_size > (case v_kind when 'photo' then 10485760 when 'video' then 52428800 else 20971520 end) then
      raise exception 'CAR_MEDIA_SIZE_INVALID';
    end if;
    select * into v_media from public.customer_car_listing_media where listing_id = p_listing_id and sha256 = v_sha;
    if found and v_media.state <> 'removed' then
      if v_media.mime_type <> v_type or v_media.size_bytes <> v_size then raise exception 'CAR_MEDIA_CONTENT_CHANGED'; end if;
      return to_jsonb(v_media);
    end if;
    if (select count(*) from public.customer_car_listing_media where listing_id = p_listing_id and state <> 'removed') >= 24 then
      raise exception 'CAR_MEDIA_LIMIT_REACHED';
    end if;
    if v_media.id is not null then
      if v_media.mime_type <> v_type or v_media.size_bytes <> v_size then raise exception 'CAR_MEDIA_CONTENT_CHANGED'; end if;
      update public.customer_car_listing_media set state='pending',is_cover=false where id=v_media.id returning * into v_media;
    else
      v_media.id := gen_random_uuid();
      insert into public.customer_car_listing_media(id,listing_id,object_path,filename,mime_type,kind,size_bytes,sha256,created_by)
      values(v_media.id,p_listing_id,p_listing_id::text||'/'||v_media.id::text||'.'||v_ext,v_name,v_type,v_kind,v_size,v_sha,(select auth.uid()))
      returning * into v_media;
    end if;
    return to_jsonb(v_media);
  end if;
  select * into v_media from public.customer_car_listing_media where id=p_media_id and listing_id=p_listing_id for update;
  if not found then raise exception 'CAR_MEDIA_NOT_FOUND'; end if;
  if p_action = 'finish' then
    if v_media.state = 'ready' then return to_jsonb(v_media); end if;
    if v_media.state <> 'pending' then raise exception 'CAR_MEDIA_NOT_PENDING'; end if;
    select * into v_object from storage.objects where bucket_id='car-listing-media' and name=v_media.object_path;
    if not found or (v_object.metadata->>'size')::bigint is distinct from v_media.size_bytes
      or (v_object.metadata->>'mimetype') is distinct from v_media.mime_type then
      raise exception 'CAR_MEDIA_UPLOAD_INCOMPLETE';
    end if;
    update public.customer_car_listing_media set state='ready',is_cover=(kind='photo' and not exists(
      select 1 from public.customer_car_listing_media where listing_id=p_listing_id and is_cover
    )) where id=v_media.id returning * into v_media;
  elsif p_action = 'cover' then
    if v_media.kind <> 'photo' or v_media.state <> 'ready' then raise exception 'CAR_MEDIA_COVER_INVALID'; end if;
    update public.customer_car_listing_media set is_cover=false where listing_id=p_listing_id and is_cover and id<>v_media.id;
    update public.customer_car_listing_media set is_cover=true where id=v_media.id returning * into v_media;
  elsif p_action = 'remove' then
    -- Recoverable metadata removal. Originals and audit history are retained.
    update public.customer_car_listing_media set state='removed',is_cover=false where id=v_media.id returning * into v_media;
    if not exists(select 1 from public.customer_car_listing_media where listing_id=p_listing_id and is_cover) then
      update public.customer_car_listing_media set is_cover=true where id=(
        select id from public.customer_car_listing_media where listing_id=p_listing_id and kind='photo' and state='ready' order by created_at,id limit 1
      );
    end if;
  else raise exception 'CAR_MEDIA_ACTION_INVALID';
  end if;
  return to_jsonb(v_media);
end;
$$;
revoke all on function private.manage_car_listing_media(text,uuid,uuid,jsonb) from public,anon;
grant execute on function private.manage_car_listing_media(text,uuid,uuid,jsonb) to authenticated;
create or replace function public.manage_car_listing_media(
  p_action text,p_listing_id uuid,p_media_id uuid default null,p_metadata jsonb default '{}'
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.manage_car_listing_media(p_action,p_listing_id,p_media_id,p_metadata);
$$;
revoke all on function public.manage_car_listing_media(text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.manage_car_listing_media(text,uuid,uuid,jsonb) to authenticated;

drop trigger if exists car_listing_media_updated_at on public.customer_car_listing_media;
create trigger car_listing_media_updated_at before update on public.customer_car_listing_media
  for each row execute function private.set_updated_at();
drop trigger if exists car_listing_media_audit on public.customer_car_listing_media;
create trigger car_listing_media_audit after insert or update on public.customer_car_listing_media
  for each row execute function private.record_audit_event();

-- Do not change listing rows or status. Existing listing notification dedupe is untouched.
