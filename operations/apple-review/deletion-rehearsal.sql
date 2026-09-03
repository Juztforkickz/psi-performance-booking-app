-- Synthetic disposable fixture only. Requires the bounded invitation demo5.
do $$
declare target_id uuid;
begin
  if not exists (select 1 from private.apple_review_installation where project_ref='jwikoldibbpxyhbdrsow')
  then raise exception 'REVIEW_PROJECT_REQUIRED'; end if;
  select user_id into strict target_id from public.customer_profiles where email='demo5@example.invalid';
  if exists (select 1 from public.staff_members where user_id=target_id)
  then raise exception 'CUSTOMER_ONLY'; end if;
  insert into public.customer_vehicles (customer_id,registration,year,make,model,nickname,created_by)
  values (target_id,'DEMODELETE',2020,'Demo','Deletion rehearsal','Disposable synthetic fixture',target_id);
  -- Represents the customer request in this controlled server-side rehearsal.
  insert into public.account_deletion_requests (user_id) values (target_id);
end $$;
