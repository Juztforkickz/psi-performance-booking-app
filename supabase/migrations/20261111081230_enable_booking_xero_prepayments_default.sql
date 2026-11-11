-- Existing queue rows retain their value. Only new deposits default to advance credits.
alter table public.booking_xero_deposit_sync
  alter column create_prepayment set default true;
