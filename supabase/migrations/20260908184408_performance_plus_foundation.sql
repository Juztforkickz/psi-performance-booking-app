-- Additive Performance+ foundation. Existing garage, kms, maintenance and dyno stay free.
create table public.performance_subscriptions (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 provider text not null check (provider in ('apple','stripe','complimentary')),
 provider_reference text not null,
 environment text not null check (environment in ('production','sandbox')),
 status text not null check (status in ('active','grace_period','expired','revoked')),
 expires_at timestamptz not null,
 auto_renews boolean not null default false,
 verified_at timestamptz not null default now(),
 unique(provider, provider_reference, environment)
);
create index performance_subscriptions_customer_idx on public.performance_subscriptions(customer_id, expires_at);
alter table public.performance_subscriptions enable row level security;
revoke all on public.performance_subscriptions from anon, authenticated;
grant select on public.performance_subscriptions to authenticated;
grant all on public.performance_subscriptions to service_role;
create policy "read own subscription status" on public.performance_subscriptions for select to authenticated
 using (customer_id=(select auth.uid()) and (select private.customer_identity_access_allowed()));
create policy "staff read subscriptions" on public.performance_subscriptions for select to authenticated
 using ((select private.is_active_staff()));

create table private.performance_settings (
 singleton boolean primary key default true check(singleton),
 allow_sandbox boolean not null default false
);
insert into private.performance_settings(singleton,allow_sandbox)
values (true, false);
revoke all on private.performance_settings from public, anon, authenticated;
create or replace function private.has_performance_plus()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and (select private.customer_identity_access_allowed())
 and exists (
 select 1 from public.performance_subscriptions s
 where s.customer_id=(select auth.uid()) and s.expires_at>now()
 and s.status in ('active','grace_period')
 and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton))
 )
$$;
revoke all on function private.has_performance_plus() from public, anon;
grant execute on function private.has_performance_plus() to authenticated;

create table public.workshop_jobs (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
 reference text not null unique check(length(btrim(reference)) between 3 and 80),
 title text not null check(length(btrim(title)) between 1 and 180),
 job_date date not null,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 unique(id, customer_id, vehicle_id)
);
create index workshop_jobs_vehicle_idx on public.workshop_jobs(vehicle_id,job_date desc);
create index workshop_jobs_customer_idx on public.workshop_jobs(customer_id);
create index workshop_jobs_creator_idx on public.workshop_jobs(created_by);
alter table public.workshop_jobs enable row level security;
grant select,insert on public.workshop_jobs to authenticated;
grant all on public.workshop_jobs to service_role;
create policy "staff read jobs" on public.workshop_jobs for select to authenticated using ((select private.is_active_staff()));
create policy "staff create checked jobs" on public.workshop_jobs for insert to authenticated
 with check ((select private.is_active_staff()) and created_by=(select auth.uid()) and exists
 (select 1 from public.customer_vehicles v where v.id=vehicle_id and v.customer_id=workshop_jobs.customer_id and v.archived_at is null));

create table public.vault_records (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null,
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
 kind text not null check(kind in ('invoice','media','dyno','service','document','modification')),
 title text not null check(length(btrim(title)) between 1 and 180),
 notes text not null default '' check(length(notes)<=10000),
 occurred_on date not null,
 power_kw numeric check(power_kw>0),
 torque_nm numeric check(torque_nm>0),
 run_stage text check(run_stage in ('before','after','baseline')),
 amount_cents integer check(amount_cents>=0),
 currency text not null default 'AUD' check(currency='AUD'),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 source text not null default 'staff' check(source in ('staff','xero','workshop_pc')),
 source_reference text,
 unique(id,customer_id,vehicle_id),
 foreign key(job_id,customer_id,vehicle_id) references public.workshop_jobs(id,customer_id,vehicle_id) on delete cascade
);
create unique index vault_records_source_idx on public.vault_records(source,source_reference) where source_reference is not null;
create index vault_records_vehicle_idx on public.vault_records(vehicle_id,occurred_on desc);
create index vault_records_customer_idx on public.vault_records(customer_id,published_at);
create index vault_records_job_idx on public.vault_records(job_id);
create index vault_records_creator_idx on public.vault_records(created_by);
alter table public.vault_records enable row level security;
grant select,insert,update on public.vault_records to authenticated;
grant all on public.vault_records to service_role;
create policy "subscribers read own published vault" on public.vault_records for select to authenticated
 using(customer_id=(select auth.uid()) and published_at is not null and (select private.has_performance_plus()));
create policy "staff read vault" on public.vault_records for select to authenticated using((select private.is_active_staff()));
create policy "staff create vault" on public.vault_records for insert to authenticated
 with check((select private.is_active_staff()) and created_by=(select auth.uid()) and source='staff');
create policy "staff publish vault" on public.vault_records for update to authenticated
 using((select private.is_active_staff())) with check((select private.is_active_staff()));

create table public.vault_assets (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null,
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
 object_path text not null unique,
 thumbnail_path text unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/webp','image/png','application/pdf')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=20971520),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 caption text not null default '' check(length(caption)<=300),
 phase text check(phase in ('before','progress','after')),
 ready boolean not null default false,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 foreign key(record_id,customer_id,vehicle_id) references public.vault_records(id,customer_id,vehicle_id) on delete cascade,
 unique(record_id,sha256),
 check (split_part(object_path,'/',1)=customer_id::text and split_part(object_path,'/',2)=vehicle_id::text
 and split_part(object_path,'/',3)=record_id::text and split_part(object_path,'/',4)=id::text
 and object_path !~ '\.\.' and array_length(string_to_array(object_path,'/'),1)=5),
 check (thumbnail_path is null or thumbnail_path=customer_id::text||'/'||vehicle_id::text||'/'||record_id::text||'/'||id::text||'/thumb.jpg')
);
create index vault_assets_record_idx on public.vault_assets(record_id);
create index vault_assets_customer_idx on public.vault_assets(customer_id);
create index vault_assets_vehicle_idx on public.vault_assets(vehicle_id);
create index vault_assets_creator_idx on public.vault_assets(created_by);
alter table public.vault_assets enable row level security;
grant select,insert,update,delete on public.vault_assets to authenticated;
grant all on public.vault_assets to service_role;
create policy "subscribers read own assets" on public.vault_assets for select to authenticated
 using(customer_id=(select auth.uid()) and ready and exists(select 1 from public.vault_records r where r.id=record_id and r.published_at is not null));
create policy "staff manage vault assets" on public.vault_assets for all to authenticated
 using((select private.is_active_staff()))
 with check((select private.is_active_staff()) and created_by=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('performance-vault','performance-vault',false,20971520,array['image/jpeg','image/webp','image/png','application/pdf']);
create policy "authorised vault downloads" on storage.objects for select to authenticated
 using(bucket_id='performance-vault' and (select private.customer_identity_access_allowed()) and exists
 (select 1 from public.vault_assets a where a.ready and (a.object_path=name or a.thumbnail_path=name)));
create policy "staff upload reserved vault objects" on storage.objects for insert to authenticated
 with check(bucket_id='performance-vault' and (select private.is_active_staff()) and exists
 (select 1 from public.vault_assets a where a.object_path=name or a.thumbnail_path=name));
create policy "staff delete vault objects" on storage.objects for delete to authenticated
 using(bucket_id='performance-vault' and (select private.is_active_staff()));

-- Only safe counts and status reach free customers. No titles, paths, dates or amounts.
create or replace function public.performance_vault_overview(p_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare counts jsonb; entitled boolean;
begin
 if (select auth.uid()) is null or not private.customer_identity_access_allowed()
 or not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null)
 then raise exception 'vehicle_access_denied' using errcode='42501'; end if;
 entitled:=private.has_performance_plus();
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from
 (select r.kind,count(*) total from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null group by r.kind) c;
 return jsonb_build_object('plan',case when entitled then 'performance_plus' else 'free' end,'counts',counts,
 'expires_at',(select max(expires_at) from public.performance_subscriptions where customer_id=(select auth.uid()) and status in ('active','grace_period') and
 (environment='production' or (select allow_sandbox from private.performance_settings where singleton))));
end $$;
revoke all on function public.performance_vault_overview(uuid) from public,anon;
grant execute on function public.performance_vault_overview(uuid) to authenticated;

create or replace function public.grant_performance_beta(p_customer_id uuid,p_days integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner_staff() or p_days not between 1 and 90 then raise exception 'owner_and_valid_duration_required' using errcode='42501'; end if;
 insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at)
 values(p_customer_id,'complimentary','beta:'||p_customer_id::text,'production','active',now()+make_interval(days=>p_days))
 on conflict(provider,provider_reference,environment) do update set status='active',expires_at=excluded.expires_at,verified_at=now();
end $$;
revoke all on function public.grant_performance_beta(uuid,integer) from public,anon;
grant execute on function public.grant_performance_beta(uuid,integer) to authenticated;

create table public.vault_import_queue (
 id uuid primary key default gen_random_uuid(),
 source text not null check(source in ('xero','workshop_pc')),
 source_key text not null,
 status text not null default 'needs_review' check(status in ('needs_review','matched','imported','failed','ignored')),
 identifiers jsonb not null default '{}'::jsonb,
 job_id uuid references public.workshop_jobs(id) on delete set null,
 reason text not null default 'Explicit vehicle and job match required',
 created_at timestamptz not null default now(),
 unique(source,source_key)
);
create index vault_import_queue_job_idx on public.vault_import_queue(job_id);
alter table public.vault_import_queue enable row level security;
grant select,update on public.vault_import_queue to authenticated;
grant all on public.vault_import_queue to service_role;
create policy "staff review imports" on public.vault_import_queue for all to authenticated
 using((select private.is_active_staff())) with check((select private.is_active_staff()));

create table private.xero_customer_links (
 tenant_id uuid not null, contact_id uuid not null,
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 verified_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz not null default now(), primary key(tenant_id,contact_id)
);
create index xero_customer_links_customer_idx on private.xero_customer_links(customer_id);
create index xero_customer_links_verifier_idx on private.xero_customer_links(verified_by);
revoke all on private.xero_customer_links from public,anon,authenticated;

create table public.vehicle_display_preferences (
 vehicle_id uuid primary key references public.customer_vehicles(id) on delete cascade,
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 illustration_id text not null default 'porsche' check(length(illustration_id) between 1 and 40)
);
create index vehicle_display_preferences_customer_idx on public.vehicle_display_preferences(customer_id);
alter table public.vehicle_display_preferences enable row level security;
grant select,insert,update on public.vehicle_display_preferences to authenticated;
grant all on public.vehicle_display_preferences to service_role;
create policy "own vehicle illustration" on public.vehicle_display_preferences for all to authenticated
 using(customer_id=(select auth.uid()) and (select private.customer_identity_access_allowed()))
 with check(customer_id=(select auth.uid()) and (select private.customer_identity_access_allowed()) and exists
 (select 1 from public.customer_vehicles v where v.id=vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null));

-- Block deleted identities even while an old JWT is still valid.
create policy "vault identity lock" on public.vault_records as restrictive for all to authenticated
 using((select private.customer_identity_access_allowed())) with check((select private.customer_identity_access_allowed()));
create policy "vault asset identity lock" on public.vault_assets as restrictive for all to authenticated
 using((select private.customer_identity_access_allowed())) with check((select private.customer_identity_access_allowed()));
