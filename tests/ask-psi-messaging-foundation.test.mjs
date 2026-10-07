import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20261006125247_ask_psi_messaging_foundation.sql', import.meta.url);
const photoMigrationUrl = new URL('../supabase/migrations/20261007075301_register_ask_psi_photo_messages.sql', import.meta.url);
const indexMigrationUrl = new URL('../supabase/migrations/20261007082034_index_ask_psi_foreign_keys.sql', import.meta.url);
const pushWorkerUrl = new URL('../supabase/functions/process-push-notifications/index.ts', import.meta.url);
const emailWorkerUrl = new URL('../supabase/functions/process-ask-psi-email-fallbacks/index.ts', import.meta.url);
const deletionWorkerUrl = new URL('../supabase/functions/complete-account-deletion/index.ts', import.meta.url);
const appConfigUrl = new URL('../mobile/app.json', import.meta.url);
const easConfigUrl = new URL('../mobile/eas.json', import.meta.url);

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
  const [migration, photoMigration, deletionWorker] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(photoMigrationUrl, 'utf8'),
    readFile(deletionWorkerUrl, 'utf8'),
  ]);

  assert.match(migration, /'ask-psi-media',[\s\S]*false,[\s\S]*10485760/u);
  assert.match(migration, /ask_psi_media_participant_select/u);
  assert.match(migration, /ask_psi_media_customer_insert/u);
  assert.match(migration, /ask_psi_media_staff_insert/u);
  assert.match(photoMigration, /create or replace function public\.send_ask_psi_photo/u);
  assert.match(photoMigration, /insert into public\.ask_psi_messages[\s\S]*insert into public\.ask_psi_attachments/u);
  assert.match(photoMigration, /split_part\(p_object_path, '\/', 1\) <> conversation\.customer_id::text/u);
  assert.match(photoMigration, /revoke all on function public\.send_ask_psi_photo/u);
  assert.match(photoMigration, /create policy ask_psi_media_failed_upload_delete/u);
  assert.match(photoMigration, /and not exists \([\s\S]*public\.ask_psi_attachments/u);
  assert.match(deletionWorker, /"ask-psi-media"/u);
});

test('Ask PSI foreign keys used by cleanup and fallback work are indexed', async () => {
  const migration = await readFile(indexMigrationUrl, 'utf8');

  assert.match(migration, /ask_psi_attachments_created_by_idx[\s\S]*ask_psi_attachments \(created_by\)/u);
  assert.match(migration, /ask_psi_conversations_created_by_idx[\s\S]*ask_psi_conversations \(created_by\)/u);
  assert.match(migration, /ask_psi_email_jobs_recipient_idx[\s\S]*ask_psi_email_jobs \(recipient_user_id, created_at desc\)/u);
});

test('Ask PSI screens remain private and disabled in public builds', async () => {
  const [stage, launcher, customerScreen, staffScreen, easConfigText] = await Promise.all([
    readFile(new URL('../mobile/src/lib/ask-psi-stage.ts', import.meta.url), 'utf8'),
    readFile(new URL('../mobile/src/components/ask-psi-launcher.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../mobile/src/app/messages.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../mobile/src/app/staff-messages.tsx', import.meta.url), 'utf8'),
    readFile(easConfigUrl, 'utf8'),
  ]);
  const easConfig = JSON.parse(easConfigText);

  assert.match(stage, /privatePreviewRequested && \(__DEV__ \|\| REVIEW_ENVIRONMENT\.enabled\)/u);
  assert.match(stage, /EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW/u);
  assert.match(launcher, /ASK_PSI_STAGE\.privatePreviewEnabled/u);
  assert.match(customerScreen, /if \(!ASK_PSI_STAGE\.privatePreviewEnabled\) router\.replace\('\/'\)/u);
  assert.match(staffScreen, /if \(!ASK_PSI_STAGE\.privatePreviewEnabled\) router\.replace\('\/staff'\)/u);
  assert.equal(easConfig.build['apple-review'].env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, 'true');
  assert.equal(easConfig.build['google-performance-test'].env.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, 'true');
  for (const profile of ['preview', 'qa', 'beta', 'app-store-release', 'android-internal', 'android-play-internal', 'production']) {
    assert.equal(easConfig.build[profile].env?.EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW, undefined, `${profile} must keep Ask PSI hidden`);
  }
});

test('Ask PSI native permissions and realtime subscriptions are declared', async () => {
  const [appConfigText, migration] = await Promise.all([
    readFile(appConfigUrl, 'utf8'),
    readFile(migrationUrl, 'utf8'),
  ]);
  const appConfig = JSON.parse(appConfigText).expo;
  const imagePickerPlugin = appConfig.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');

  assert.match(appConfig.ios.infoPlist.NSPhotoLibraryUsageDescription, /vehicle photos/u);
  assert.equal(imagePickerPlugin[1].microphonePermission, false);
  assert.match(imagePickerPlugin[1].photosPermission, /vehicle photos/u);
  assert.match(migration, /alter publication supabase_realtime add table public\.ask_psi_conversations/u);
  assert.match(migration, /alter publication supabase_realtime add table public\.ask_psi_messages/u);
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
