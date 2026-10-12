-- Optional private identity metadata. Existing customer/staff RLS still applies.
alter table public.vault_assets
  add column if not exists source_sha256 text,
  add column if not exists visual_signature text;
alter table public.vault_assets
  add constraint vault_assets_source_sha256_check check (source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint vault_assets_visual_signature_check check (visual_signature is null or (length(visual_signature) <= 24620 and visual_signature ~ '^rgb64:[1-9][0-9]*:[1-9][0-9]*:[a-f0-9]+$' and length(split_part(visual_signature, ':', 4)) = 24576));
-- Only the Photos writers populate source_sha256. Protect exact copies from
-- concurrent portal/PC uploads without changing historical records.
create unique index vault_assets_photo_source_unique on public.vault_assets(customer_id, vehicle_id, source_sha256) where source_sha256 is not null;
