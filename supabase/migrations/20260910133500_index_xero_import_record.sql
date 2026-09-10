-- Supports record cleanup and reconciliation through the new import-record link.
create index vault_import_queue_record_idx
  on public.vault_import_queue(record_id)
  where record_id is not null;
