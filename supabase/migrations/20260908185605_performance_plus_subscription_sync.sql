-- Verified subscription updates are server-only and ignore stale responses.
create or replace function public.record_verified_performance_subscription(
 p_customer_id uuid,p_environment text,p_status text,p_expires_at timestamptz,p_auto_renews boolean,p_verified_at timestamptz
) returns void language sql security invoker set search_path='' as $$
 insert into public.performance_subscriptions(customer_id,provider,provider_reference,environment,status,expires_at,auto_renews,verified_at)
 values(p_customer_id,'apple','revenuecat:'||p_customer_id::text,p_environment,p_status,p_expires_at,p_auto_renews,p_verified_at)
 on conflict(provider,provider_reference,environment) do update set
 status=excluded.status,expires_at=excluded.expires_at,auto_renews=excluded.auto_renews,verified_at=excluded.verified_at
 where public.performance_subscriptions.verified_at<excluded.verified_at
$$;
revoke all on function public.record_verified_performance_subscription(uuid,text,text,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.record_verified_performance_subscription(uuid,text,text,timestamptz,boolean,timestamptz) to service_role;

create trigger performance_subscription_audit after insert or update or delete on public.performance_subscriptions
 for each row execute function private.record_audit_event();
create trigger vault_record_audit after insert or update or delete on public.vault_records
 for each row execute function private.record_audit_event();

-- Customer clients must use the authenticated Edge Function: they cannot mint
-- arbitrary long-lived Storage links to outlive a subscription.
drop policy "authorised vault downloads" on storage.objects;
create policy "staff vault downloads" on storage.objects for select to authenticated
 using(bucket_id='performance-vault' and (select private.is_active_staff()));

-- Even authenticated clients cannot silently move a workshop job to another owner.
create or replace function private.check_vault_publication()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.customer_id<>new.customer_id or old.vehicle_id<>new.vehicle_id or old.job_id<>new.job_id then
 raise exception 'vault_record_target_immutable'; end if;
 if new.published_at is not null and exists(select 1 from public.vault_assets a where a.record_id=new.id and not a.ready) then
 raise exception 'vault_uploads_incomplete'; end if;
 if new.published_at is not null and new.kind='dyno' and not exists(select 1 from public.vault_assets a where a.record_id=new.id and a.ready and a.mime_type='application/pdf') then
 raise exception 'dyno_pdf_required'; end if;
 return new;
end $$;
revoke all on function private.check_vault_publication() from public,anon,authenticated;
create trigger check_vault_publication before update on public.vault_records for each row execute function private.check_vault_publication();

revoke all on public.workshop_jobs,public.vault_records,public.vault_assets,public.vault_import_queue,public.vehicle_display_preferences from anon;
