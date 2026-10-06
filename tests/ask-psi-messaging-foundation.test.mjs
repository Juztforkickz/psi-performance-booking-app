import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20261006125247_ask_psi_messaging_foundation.sql', import.meta.url);
const pushWorkerUrl = new URL('../supabase/functions/process-push-notifications/index.ts', import.meta.url);
const emailWorkerUrl = new URL('../supabase/functions/process-ask-psi-email-fallbacks/index.ts', import.meta.url);
const deletionWorkerUrl = new URL('../supabase/functions/complete-account-deletion/index.ts', import.meta.url);

test('Ask PSI messaging foundation stays private and participant scoped', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  for (const table of ['ask_psi_conversations', 'ask_psi_messages', 'ask_psi_attachments', 'ask_psi_email_jobs']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'u'));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'u'));
  }

  assert.match(migration, /conversation\.customer_id = \(select auth\.uid\(\)\)/u);
  assert.match(migration, /select private\.is_active_staff\(\)/u);
  assert.match(migration, /security invoker/u);
  assert.match(migration, /security definer[\s\S]*authentication_required/u);
  assert.match(migration, /revoke all on function public\.mark_ask_psi_conversation_read/u);
  assert.doesNotMatch(migration, /to anon[\s\S]*(select|insert|update|delete)/u);
});

test('Ask PSI messages are immutable, idempotent and carry read timestamps', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(migration, /unique index ask_psi_messages_client_nonce_unique_idx/u);
  assert.match(migration, /customer_last_read_at timestamptz/u);
  assert.match(migration, /staff_last_read_at timestamptz/u);
  assert.match(migration, /mark_ask_psi_conversation_read/u);
  assert.match(migration, /read_before_email_fallback/u);
  assert.doesNotMatch(migration, /grant update[^;]*ask_psi_messages/iu);
  assert.doesNotMatch(migration, /grant delete[^;]*ask_psi_messages/iu);
});

test('Ask PSI photo storage is private and removed during account deletion', async () => {
  const [migration, deletionWorker] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(deletionWorkerUrl, 'utf8'),
  ]);

  assert.match(migration, /'ask-psi-media',[\s\S]*false,[\s\S]*10485760/u);
  assert.match(migration, /ask_psi_media_participant_select/u);
  assert.match(migration, /ask_psi_media_customer_insert/u);
  assert.match(migration, /ask_psi_media_staff_insert/u);
  assert.match(deletionWorker, /"ask-psi-media"/u);
});

test('Ask PSI notifications use the existing scoped push queue', async () => {
  const [migration, pushWorker] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(pushWorkerUrl, 'utf8'),
  ]);

  assert.match(migration, /'customer_message_received'/u);
  assert.match(migration, /'staff_message_received'/u);
  assert.match(migration, /ask_psi_conversation_id/u);
  assert.match(pushWorker, /askPsiConversationId/u);
  assert.match(pushWorker, /from\("ask_psi_conversations"\)/u);
  assert.match(pushWorker, /message_access_denied/u);
  assert.match(pushWorker, /message_alerts_enabled/u);
  assert.match(pushWorker, /customer_message_received/u);
  assert.match(pushWorker, /staff_message_received/u);
});

test('Unread email fallback uses Microsoft 365 and excludes message content', async () => {
  const [migration, emailWorker] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(emailWorkerUrl, 'utf8'),
  ]);

  assert.match(migration, /provider text not null default 'microsoft_365'/u);
  assert.match(migration, /now\(\) \+ interval '15 minutes'/u);
  assert.match(emailWorker, /login\.microsoftonline\.com/u);
  assert.match(emailWorker, /graph\.microsoft\.com\/v1\.0\/users/u);
  assert.match(emailWorker, /The private message content is available only after signing in/u);
  assert.doesNotMatch(emailWorker, /gmail/iu);
  assert.doesNotMatch(emailWorker, /\.select\([^\n]*body/iu);
});
