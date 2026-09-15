CREATE OR REPLACE FUNCTION private.performance_vault_overview(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 counts jsonb;
 entitled boolean;
 permanent_access boolean;
 access_expires_at timestamptz;
begin
 if (select auth.uid()) is null or not private.customer_identity_access_allowed()
 or not exists(select 1 from public.customer_vehicles v where v.id=p_vehicle_id and v.customer_id=(select auth.uid()) and v.archived_at is null)
 then raise exception 'vehicle_access_denied' using errcode='42501'; end if;

 entitled:=private.has_performance_plus();
 select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) into counts from
 (select kind,count(*) total from (select r.kind from public.vault_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.published_at is not null union all select 'invoice' from public.invoices i where i.customer_id=(select auth.uid()) and i.vehicle_id=p_vehicle_id and i.archived_at is null
 union all select 'dyno' from public.dyno_records d where d.customer_id=(select auth.uid()) and d.vehicle_id=p_vehicle_id and d.archived_at is null
 union all select 'service' from public.repair_records r where r.customer_id=(select auth.uid()) and r.vehicle_id=p_vehicle_id and r.archived_at is null
 union all select 'recommendation' from public.recommended_work w where w.customer_id=(select auth.uid()) and w.vehicle_id=p_vehicle_id and w.archived_at is null union all select 'document' from public.vehicle_files f where f.customer_id=(select auth.uid()) and f.vehicle_id=p_vehicle_id and f.file_kind='repair_document' and f.archived_at is null) records group by kind) c;

 select coalesce(bool_or(s.is_permanent),false),
 max(s.expires_at) filter (where not s.is_permanent)
 into permanent_access,access_expires_at
 from public.performance_subscriptions s
 where s.customer_id=(select auth.uid())
 and s.status in ('active','grace_period')
 and (s.is_permanent or s.expires_at>now())
 and (s.environment='production' or (select allow_sandbox from private.performance_settings where singleton));

 return jsonb_build_object(
   'plan',case when entitled then 'performance_plus' else 'free' end,
   'counts',counts,
   'expires_at',case when permanent_access then null else access_expires_at end,
   'is_permanent',permanent_access
 );
end $function$;
