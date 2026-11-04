-- FOR SHARE requires UPDATE on at least one column. The worker may lock the
-- policy using its immutable true singleton key, but cannot edit financial rules.
-- No balances, activation dates, functions, RLS policies or earning rates change.
begin;
do $$
declare recorded text; actual text; protected text;
begin
  select contract_sha256 into recorded from private.rewards_bonus_schema_version where version=2;
  actual := private.rewards_bonus_schema_contract();
  if recorded is null or recorded <> actual then raise exception 'rewards_bonus_schema_mismatch'; end if;
  if not exists(select 1 from pg_constraint where conrelid='private.rewards_bonus_policy'::regclass
    and pg_get_constraintdef(oid)='CHECK (singleton)')
    or not exists(select 1 from pg_attribute where attrelid='private.rewards_bonus_policy'::regclass
      and attname='singleton' and attnotnull and atttypid='boolean'::regtype) then
    raise exception 'rewards_policy_singleton_not_immutable';
  end if;
  if has_table_privilege('service_role','private.rewards_bonus_policy','UPDATE,INSERT,DELETE') then
    raise exception 'rewards_policy_unexpected_writer';
  end if;
  for protected in select attname from pg_attribute where attrelid='private.rewards_bonus_policy'::regclass
    and attnum>0 and not attisdropped and attname<>'singleton' loop
    if has_column_privilege('service_role','private.rewards_bonus_policy',protected,'UPDATE') then
      raise exception 'rewards_policy_unexpected_column_writer';
    end if;
  end loop;
  if has_any_column_privilege('anon','private.rewards_bonus_policy','UPDATE')
    or has_any_column_privilege('authenticated','private.rewards_bonus_policy','UPDATE') then
    raise exception 'rewards_policy_customer_writer';
  end if;
end $$;

grant update(singleton) on private.rewards_bonus_policy to service_role;

do $$ begin
  if not has_column_privilege('service_role','private.rewards_bonus_policy','singleton','UPDATE')
    or has_table_privilege('service_role','private.rewards_bonus_policy','UPDATE') then
    raise exception 'rewards_policy_lock_permission_invalid';
  end if;
end $$;
commit;
