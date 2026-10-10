-- Personal artwork access is resolved from the existing verified owner role.
-- No account UUID, email, registration or image bytes are included in source.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('owner-garage-artwork','owner-garage-artwork',false,2097152,array['image/jpeg'])
on conflict(id) do nothing;

do $migration$
declare owner_id uuid;
begin
  select u.id into strict owner_id
  from public.staff_members s join auth.users u on u.id=s.user_id
  where s.role='owner' and s.status='active'
    and u.email_confirmed_at is not null and u.deleted_at is null;
  if (select public from storage.buckets where id='owner-garage-artwork') then
    raise exception 'personal_artwork_bucket_must_be_private';
  end if;

  execute format('create policy "account personal artwork selection" on public.vehicle_display_preferences as restrictive for all to authenticated using (illustration_id <> %L or customer_id = %L::uuid) with check (illustration_id <> %L or customer_id = %L::uuid)',
    'personal-vehicle-artwork',owner_id,'personal-vehicle-artwork',owner_id);

  drop policy if exists "owner garage artwork read" on storage.objects;
  drop policy if exists "owner garage artwork isolation" on storage.objects;
  execute format('create policy "owner garage artwork read" on storage.objects for select to authenticated using (bucket_id = %L and (select auth.uid()) = %L::uuid and (storage.foldername(name))[1] = %L and (select private.customer_identity_access_allowed()))',
    'owner-garage-artwork',owner_id,owner_id::text);
  execute format('create policy "owner garage artwork isolation" on storage.objects as restrictive for all to authenticated using (bucket_id <> %L or ((select auth.uid()) = %L::uuid and (storage.foldername(name))[1] = %L)) with check (bucket_id <> %L or ((select auth.uid()) = %L::uuid and (storage.foldername(name))[1] = %L))',
    'owner-garage-artwork',owner_id,owner_id::text,'owner-garage-artwork',owner_id,owner_id::text);
end $migration$;
