alter table public.customer_profiles
  add column profile_photo_object_path text,
  add column profile_photo_mime_type text,
  add column profile_photo_updated_at timestamptz;

alter table public.customer_profiles
  add constraint customer_profiles_photo_fields_complete check (
    (profile_photo_object_path is null and profile_photo_mime_type is null and profile_photo_updated_at is null)
    or (
      profile_photo_object_path is not null
      and profile_photo_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and profile_photo_updated_at is not null
    )
  ),
  add constraint customer_profiles_photo_owned_path check (
    profile_photo_object_path is null
    or (
      split_part(profile_photo_object_path, '/', 1) = user_id::text
      and split_part(profile_photo_object_path, '/', 2) = 'profile'
    )
  );

comment on column public.customer_profiles.profile_photo_object_path is
  'Private vehicle-photos bucket object owned by this customer; never expose as a public URL.';
