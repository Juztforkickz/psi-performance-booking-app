import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  accountScreen,
  setupScreen,
  authClient,
  authContext,
  accountContext,
  accountAdapter,
  authStorage,
  supabaseClient,
  appConfig,
  easConfig,
  pagesWorkflow,
] = await Promise.all([
  read('../mobile/src/app/account/index.tsx'),
  read('../mobile/src/app/account/sign-up.tsx'),
  read('../mobile/src/lib/customer-auth.ts'),
  read('../mobile/src/lib/customer-auth-context.tsx'),
  read('../mobile/src/lib/customer-account-context.tsx'),
  read('../mobile/src/lib/customer-account.ts'),
  read('../mobile/src/lib/supabase-auth-storage.ts'),
  read('../mobile/src/lib/supabase.ts'),
  read('../mobile/app.json'),
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
  assert.match(accountContext, /authSessionRevision = auth\.sessionRevision/u);
  assert.match(accountContext, /\[authSessionRevision, authStatus, authUserId, refreshIndex\]/u);
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
  const app = JSON.parse(appConfig);
  const eas = JSON.parse(easConfig);
  assert.equal(app.expo.owner, 'psi-performance');
  assert.equal(app.expo.extra.eas.projectId, 'e62e9cdf-867c-4eb7-b8c5-a2610f969286');
  assert.equal(eas.build.qa.distribution, 'internal');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, 'true');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'false');
  assert.equal(eas.build.qa.env.EXPO_PUBLIC_API_BASE_URL, undefined);
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_API_BASE_URL, undefined);
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED, 'false');
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED, 'false');
});

test('profile setup keeps account photos private and public-preview photos local', () => {
  assert.match(setupScreen, /uploadCustomerVehiclePhoto/u);
  assert.match(setupScreen, /storageMode=\{CUSTOMER_AUTH\.enabled \? 'private_account' : 'local_preview'\}/u);
  assert.match(setupScreen, /private bucket protected by customer ownership rules/u);
  assert.doesNotMatch(setupScreen, /service_role|sb_secret_|getPublicUrl/u);
});
