create or replace function private.performance_vault_overview(p_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare counts jsonb; entitled boolean;
begin
 if (select auth.uid()) is null or not private.customer_identity_access_allowed()
 or not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null)
 then raise exception 'vehicle_access_denied' using errcode='42501'; end if;
 entitled:=private.has_performance_plus();
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from
 (select kind,count(*) total from (select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null) records group by kind) c;
 return jsonb_build_object('plan',case when entitled then 'performance_plus' else 'free' end,'counts',counts,
 'expires_at',(select max(expires_at) from public.performance_subscriptions where customer_id=(select auth.uid()) and status in ('active','grace_period') and
 (environment='production' or (select allow_sandbox from private.performance_settings where singleton))));
end $$;
revoke all on function private.performance_vault_overview(uuid) from public,anon;
grant execute on function private.performance_vault_overview(uuid) to authenticated;


create table public.vault_updates(
 job_id uuid primary key references public.workshop_jobs(id) on delete cascade,
 customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
 vehicle_id uuid not null references public.customer_vehicles(id) on delete cascade,
 updated_at timestamptz not null default now(),
 record_count integer not null default 1
);
create index vault_updates_customer_idx on public.vault_updates(customer_id,updated_at desc);
create index vault_updates_vehicle_idx on public.vault_updates(vehicle_id);
alter table public.vault_updates enable row level security;
revoke all on public.vault_updates from public,anon,authenticated;
grant select on public.vault_updates to authenticated;
grant all on public.vault_updates to service_role;
create policy "own vehicle update notices" on public.vault_updates for select to authenticated
 using(customer_id=(select auth.uid()) and (select private.customer_identity_access_allowed()));
create or replace function private.notify_vault_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.published_at is not null and (tg_op='INSERT' or old.published_at is null) then
 insert into public.vault_updates(job_id,customer_id,vehicle_id,record_count)
 values(new.job_id,new.customer_id,new.vehicle_id,1)
 on conflict(job_id) do update set record_count=public.vault_updates.record_count+1,updated_at=now();
 end if;
 return new;
end $$;
revoke all on function private.notify_vault_update() from public,anon,authenticated;
create trigger notify_vault_update after insert or update on public.vault_records for each row execute function private.notify_vault_update();
