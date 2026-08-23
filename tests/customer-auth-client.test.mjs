import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  accountScreen,
  setupScreen,
  authClient,
  authContext,
  accountAdapter,
  authStorage,
  supabaseClient,
  easConfig,
  pagesWorkflow,
] = await Promise.all([
  read('../mobile/src/app/account/index.tsx'),
  read('../mobile/src/app/account/sign-up.tsx'),
  read('../mobile/src/lib/customer-auth.ts'),
  read('../mobile/src/lib/customer-auth-context.tsx'),
  read('../mobile/src/lib/customer-account.ts'),
  read('../mobile/src/lib/supabase-auth-storage.ts'),
  read('../mobile/src/lib/supabase.ts'),
  read('../mobile/eas.json'),
  read('../.github/workflows/mobile-pages-preview.yml'),
]);

test('email-code UI and session lifecycle remain activation-gated', () => {
  assert.match(accountScreen, /CUSTOMER_AUTH\.enabled/u);
  assert.match(accountScreen, /requestPasswordlessEmailCode/u);
  assert.match(accountScreen, /verifyPasswordlessEmailCode/u);
  assert.match(accountScreen, /Six-digit code/u);
  assert.doesNotMatch(`${accountScreen}\n${setupScreen}`, /type=["']password|passwordHash|setPassword/iu);
  assert.match(authClient, /shouldCreateUser: CUSTOMER_AUTH\.registrationEnabled/u);
  assert.match(authClient, /registrationEnabled: SUPABASE_CONNECTION\.registrationEnabled/u);
  assert.match(authClient, /type: 'email'/u);
  assert.match(authContext, /onAuthStateChange/u);
  assert.match(authContext, /auth\.getUser\(\)/u);
});

test('authenticated account adapter binds all rows to the verified user', () => {
  assert.match(accountAdapter, /auth\.getUser\(\)/u);
  assert.match(accountAdapter, /\.eq\('user_id', user\.id\)/u);
  assert.match(accountAdapter, /customer_id: user\.id/u);
  assert.match(accountAdapter, /created_by: user\.id/u);
  assert.match(accountAdapter, /email,\s*first_name:/u);
  assert.doesNotMatch(accountAdapter, /service_role|sb_secret_|EXPO_PUBLIC_API_BASE_URL/u);
  assert.doesNotMatch(accountAdapter, /AsyncStorage|localStorage|route\.params|searchParams/u);
});

test('public Pages preview keeps real account activation explicitly disabled', () => {
  assert.match(pagesWorkflow, /EXPO_PUBLIC_SUPABASE_AUTH_ENABLED:\s*['"]false['"]/u);
  assert.match(pagesWorkflow, /EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED:\s*['"]false['"]/u);
  assert.match(supabaseClient, /requestedRegistrationActivation/u);
  assert.match(supabaseClient, /requestedAuthActivation\s*&&\s*requestedRegistrationActivation/u);
  assert.match(authStorage, /Platform\.OS === 'web' \? webMemoryStorage/u);
  assert.doesNotMatch(authStorage, /window\.localStorage|AsyncStorage/u);
});

test('private QA profile enables existing-account auth without registration or booking APIs', () => {
  const eas = JSON.parse(easConfig);
  assert.equal(eas.build.qa.distribution, 'internal');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, 'true');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'false');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_API_BASE_URL, '');
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, 'false');
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'false');
});

test('profile setup never uploads the selected vehicle photo', () => {
  assert.match(setupScreen, /Vehicle photos are still local-only and are not uploaded/u);
  assert.doesNotMatch(setupScreen, /storage\.from|\.upload\(|fetch\(/u);
});
