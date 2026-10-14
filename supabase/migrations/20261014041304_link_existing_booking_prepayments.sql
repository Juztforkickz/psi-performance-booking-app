-- Existing, individually verified advance credits can be consumed without
-- recording a second receipt when their booking invoice is published.
alter table public.booking_xero_deposit_sync
  add column prepayment_bank_transaction_id uuid,
  add column prepayment_contact_id uuid,
  add column prepayment_id uuid,
  add column prepayment_applied boolean not null default false,
  add constraint booking_prepayment_mapping_complete check (
    (prepayment_bank_transaction_id is null) = (prepayment_contact_id is null)
  );
create unique index booking_xero_unique_prepayment_bank_entry
on public.booking_xero_deposit_sync(prepayment_bank_transaction_id)
where prepayment_bank_transaction_id is not null;
create unique index booking_xero_unique_prepayment
on public.booking_xero_deposit_sync(prepayment_id)
where prepayment_id is not null;
