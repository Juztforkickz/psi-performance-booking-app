-- The Apple-review environment permits a limited password-only staff session.
-- Xero setup always requires actual AAL2, independently of that exception.
create or replace function private.begin_xero_oauth(p_state_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner_staff() or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
 then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 if p_state_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_state'; end if;
 delete from private.xero_oauth_states where expires_at<=now() or owner_id=(select auth.uid());
 insert into private.xero_oauth_states(state_hash,owner_id) values(p_state_hash,(select auth.uid()));
end $$;
create or replace function private.xero_connection_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_owner_staff() or coalesce((select auth.jwt()->>'aal'),'')<>'aal2'
 then raise exception 'owner_mfa_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('tenant_id',tenant_id,'connected_at',connected_at,'updated_at',updated_at)) from private.xero_connections),'[]'::jsonb);
end $$;
