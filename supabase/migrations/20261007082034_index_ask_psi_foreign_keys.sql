create index if not exists ask_psi_attachments_created_by_idx
  on public.ask_psi_attachments (created_by);

create index if not exists ask_psi_conversations_created_by_idx
  on public.ask_psi_conversations (created_by);

create index if not exists ask_psi_email_jobs_recipient_idx
  on public.ask_psi_email_jobs (recipient_user_id, created_at desc);
