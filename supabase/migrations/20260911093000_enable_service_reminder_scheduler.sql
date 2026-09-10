-- Supabase Cron invokes the due-reminder Edge Function on a daily cadence.
-- The protected credential and the concrete job are configured per project in
-- Supabase Vault so no service credential is ever stored in source control.
create extension if not exists pg_net;
create extension if not exists pg_cron;
