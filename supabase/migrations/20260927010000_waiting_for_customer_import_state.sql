alter table public.vault_import_queue
  drop constraint if exists vault_import_queue_status_check;

alter table public.vault_import_queue
  add constraint vault_import_queue_status_check
  check (status in ('pending', 'processing', 'needs_review', 'waiting_for_customer', 'matched', 'imported', 'failed', 'ignored'));
