-- Run only in an isolated database with the description-registration migration.
-- The caller supplies psi.test_owner, psi.test_customer, psi.test_job and
-- psi.test_queue fixture IDs and an authenticated owner AAL2 test session.
begin;
do $$
declare
  q uuid := current_setting('psi.test_queue')::uuid;
  c uuid := current_setting('psi.test_customer')::uuid;
  j uuid := current_setting('psi.test_job')::uuid;
begin
  update public.vault_import_queue set status = 'needs_review', identifiers = identifiers ||
    jsonb_build_object('reference', 'VZ SERVICE / REPAIRS / BRAKES / TUNE / TACHO', 'descriptionRegistration', 'TEST42') where id = q;
  perform private.confirm_xero_import_match(q, c, j);
  if not exists(select 1 from public.vault_import_queue where id = q and status = 'matched' and job_id = j) then
    raise exception 'description_registration_not_matched';
  end if;
  begin
    perform private.confirm_xero_import_match(q, c, j);
    raise exception 'replay_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_import_not_reviewable' then raise; end if;
  end;

  update public.vault_import_queue set status = 'failed' where id = q;
  perform private.confirm_xero_import_match(q, c, j);

  update public.vault_import_queue set status = 'needs_review' where id = q;
  begin
    perform private.confirm_xero_import_match(q, gen_random_uuid(), j);
    raise exception 'wrong_customer_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_customer_vehicle_job_mismatch' then raise; end if;
  end;

  update public.vault_import_queue set identifiers = identifiers || jsonb_build_object('descriptionRegistration', 'TEST4') where id = q;
  begin
    perform private.confirm_xero_import_match(q, c, j);
    raise exception 'partial_registration_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_invoice_vehicle_evidence_required' then raise; end if;
  end;

  update public.vault_import_queue set identifiers = identifiers || jsonb_build_object('descriptionRegistration', null) where id = q;
  begin
    perform private.confirm_xero_import_match(q, c, j);
    raise exception 'missing_registration_was_allowed';
  exception when raise_exception then
    if sqlerrm <> 'xero_invoice_vehicle_evidence_required' then raise; end if;
  end;

  update public.vault_import_queue set identifiers = identifiers || jsonb_build_object('reference', 'SERVICE TEST42') where id = q;
  perform private.confirm_xero_import_match(q, c, j);
  update public.vault_import_queue set status = 'needs_review', identifiers = identifiers ||
    jsonb_build_object('reference', (select reference from public.workshop_jobs where id = j)) where id = q;
  perform private.confirm_xero_import_match(q, c, j);

  if (select count(*) from private.xero_customer_links where customer_id = c) <> 1 then
    raise exception 'duplicate_customer_link';
  end if;
end $$;
select 'PASS: description registration, retry, replay, wrong customer, partial/missing evidence and legacy references' as result;
rollback;
