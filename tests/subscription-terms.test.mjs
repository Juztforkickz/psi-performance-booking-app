import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const purchasesSource = await compile('../mobile/src/lib/performance-purchases.ts');
const termsSource = await compile('../mobile/src/app/subscription-terms.tsx');
const privacySource = await compile('../mobile/src/app/privacy.tsx');

function renderLegalScreen(source, { platform = 'ios', auth = true, review = false, key = '', purchaseTest = false, appleReview = false } = {}) {
  const pricing = { monthly: 999, annual: 9900 };
  const imports = {
    'react-native': { Platform: { OS: platform }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    './performance-plus': { s: {} },
    '@/components/ui': { PrimaryButton: 'PrimaryButton' },
    '@/constants/brand': { colors: {}, mobileFrame: {}, spacing: {} },
    '@/hooks/use-responsive-layout': { useResponsiveLayout: () => ({ horizontalPadding: 22 }) },
    '@/lib/customer-auth': { CUSTOMER_AUTH: { enabled: auth } },
    '@/lib/review-environment': { REVIEW_ENVIRONMENT: { enabled: review } },
    '@/lib/supabase': { getSupabaseClient() { throw new Error('Rendering terms must not access a backend'); } },
    '@/lib/performance-plus': { PERFORMANCE_PRICING: pricing, aud: (cents) => `A$${(cents / 100).toFixed(2)} AUD` },
  };
  const purchases = {};
  vm.runInNewContext(purchasesSource, {
    exports: purchases,
    require: (name) => imports[name],
    process: { env: {
      EXPO_PUBLIC_REVENUECAT_APPLE_KEY: key,
      EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST: String(purchaseTest),
      EXPO_PUBLIC_PSI_APPLE_REVIEW: String(appleReview),
    } },
  });
  imports['@/lib/performance-purchases'] = purchases;
  const screen = {};
  vm.runInNewContext(source, { exports: screen, require: (name) => imports[name] });
  const text = (node) => typeof node === 'string' ? node
    : Array.isArray(node) ? node.map(text).join(' ')
      : node?.props ? text(node.props.children) : '';
  return text(screen.default());
}
const renderTerms = (options) => renderLegalScreen(termsSource, options);
const renderPrivacy = (options) => renderLegalScreen(privacySource, options);

test('current beta and demo builds keep a clear disabled purchase notice', () => {
  for (const options of [{}, { auth: false, key: 'appl_fixture' }, { review: true, key: 'appl_fixture' }]) {
    const text = renderTerms(options);
    assert.match(text, /Paid subscriptions are unavailable in this build/);
    assert.doesNotMatch(text, /Sandbox purchase testing is enabled/);
  }
});

test('isolated iOS purchase-test build shows sandbox instructions', () => {
  const text = renderTerms({ key: 'appl_fixture', review: true, purchaseTest: true, appleReview: true });
  assert.match(text, /Sandbox purchase testing is enabled/);
  assert.match(text, /Apple sandbox test account/);
  assert.doesNotMatch(text, /Paid subscriptions are unavailable/);
});

test('a purchase-test flag alone does not advertise available sandbox purchases', () => {
  const text = renderTerms({ key: 'appl_fixture', review: true, purchaseTest: true });
  assert.match(text, /Paid subscriptions are unavailable/);
  assert.doesNotMatch(text, /Sandbox purchase testing is enabled/);
});

test('configured live iOS build has normal purchase guidance', () => {
  const text = renderTerms({ key: 'appl_fixture' });
  assert.match(text, /Choose a plan on the Performance\+ page/);
  assert.doesNotMatch(text, /unavailable in this build|Sandbox purchase testing/);
});

test('unsupported platforms and test-store keys cannot advertise Apple subscriptions', () => {
  for (const options of [{ platform: 'web', key: 'appl_fixture' }, { platform: 'android', key: 'appl_fixture' }, { key: 'test_fixture' }]) {
    assert.match(renderTerms(options), /Paid subscriptions are unavailable/);
  }
});

test('privacy preserves unavailable wording for beta, demo and unsupported purchase configurations', () => {
  for (const options of [{}, { auth: false, key: 'appl_fixture' }, { review: true, key: 'appl_fixture' }, { platform: 'web', key: 'appl_fixture' }, { key: 'test_fixture' }]) {
    const text = renderPrivacy(options);
    assert.match(text, /paid subscriptions are unavailable in this build/);
    assert.doesNotMatch(text, /subscriptions are available for Apple sandbox/);
  }
});

test('privacy and terms agree on enabled isolated sandbox purchase testing', () => {
  const text = renderPrivacy({ key: 'appl_fixture', review: true, purchaseTest: true, appleReview: true });
  assert.match(text, /subscriptions are available for Apple sandbox purchase testing/);
  assert.doesNotMatch(text, /paid purchases are not open|paid subscriptions are unavailable/);
});

test('configured live iOS privacy describes conditional Apple product availability', () => {
  const text = renderPrivacy({ key: 'appl_fixture' });
  assert.match(text, /subscriptions can be purchased through Apple when the products are available/);
  assert.doesNotMatch(text, /paid purchases are not open|paid subscriptions are unavailable|sandbox purchase testing/);
});

test('privacy keeps provider, subscription-data and cancellation disclosures in every purchase mode', () => {
  for (const options of [{}, { key: 'appl_fixture' }, { key: 'appl_fixture', review: true, purchaseTest: true, appleReview: true }]) {
    const text = renderPrivacy(options);
    assert.match(text, /RevenueCat verifies subscription transactions linked to your PSI account identifier/);
    assert.match(text, /Workshop photographs and PDFs are not sent to RevenueCat/);
    assert.match(text, /may process subscription data outside Australia/);
    assert.match(text, /Deleting your PSI account or app does not cancel an Apple subscription/);
    assert.match(text, /Payment-card details are not collected or stored by this app/);
  }
});
