import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = ts.transpileModule(await readFile(new URL('../mobile/src/lib/performance-purchases.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const isolatedApple = { review: true, purchaseTest: true, appleReview: true };

function checkout({
  platform = 'ios', review = false, purchaseTest = false, appleReview = false, googleReview = false,
  currencyCode = 'AUD', monthlyId = 'psi_performance_plus_monthly', annualId = 'psi_performance_plus_annual',
  storefront = { countryCode: 'AUS' }, purchaseError = null, verificationError = null, verified = true,
} = {}) {
  const calls = [];
  const userId = 'psi-test-customer';
  const state = { storefront, storefrontError: null, authUserId: userId, authError: null };
  const makePackage = (identifier, productId) => ({
    identifier,
    product: { identifier: productId, price: 1, priceString: 'Store-formatted price', currencyCode },
  });
  const monthly = makePackage('$rc_monthly', monthlyId);
  const annual = makePackage('$rc_annual', annualId);
  const sdk = {
    configure: (options) => calls.push({ type: 'configure', options }),
    logIn: async (id) => calls.push({ type: 'logIn', id }),
    getOfferings: async () => ({ all: { performance_plus: { monthly, annual, availablePackages: [monthly, annual] } } }),
    getStorefront: async () => {
      calls.push({ type: 'storefront' });
      if (state.storefrontError) throw state.storefrontError;
      return state.storefront;
    },
    purchasePackage: async (item) => {
      calls.push({ type: 'purchase', item });
      if (purchaseError) throw purchaseError;
      return { customerInfo: { entitlements: { active: { performance_plus: {} } } } };
    },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: state.authUserId ? { id: state.authUserId } : null }, error: state.authError }) },
    functions: { invoke: async (name, options) => {
      calls.push({ type: 'verify', name, options });
      return { data: { verified }, error: verificationError };
    } },
  };
  const imports = {
    'react-native': { Platform: { OS: platform } },
    'react-native-purchases': { __esModule: true, default: sdk },
    '@/lib/customer-auth': { CUSTOMER_AUTH: { enabled: true } },
    '@/lib/review-environment': { REVIEW_ENVIRONMENT: { enabled: review } },
    '@/lib/supabase': { getSupabaseClient: () => client },
  };
  const api = {};
  vm.runInNewContext(source, {
    exports: api,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected checkout dependency: ${name}`);
      return imports[name];
    },
    process: { env: {
      EXPO_PUBLIC_REVENUECAT_APPLE_KEY: 'appl_fixture',
      EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY: 'goog_fixture',
      EXPO_PUBLIC_PERFORMANCE_PURCHASE_TEST: String(purchaseTest),
      EXPO_PUBLIC_PSI_APPLE_REVIEW: String(appleReview),
      EXPO_PUBLIC_PSI_GOOGLE_REVIEW: String(googleReview),
    } },
  });
  return {
    calls, state, monthly, annual,
    load: () => api.loadPerformancePlusStorePrices(userId),
    purchase: (period = 'monthly') => api.purchasePerformancePlus(userId, period),
  };
}

const purchases = (fixture) => fixture.calls.filter(({ type }) => type === 'purchase');
const verifications = (fixture) => fixture.calls.filter(({ type }) => type === 'verify');
const storefrontReads = (fixture) => fixture.calls.filter(({ type }) => type === 'storefront');
const assertNotPurchased = (fixture) => {
  assert.equal(purchases(fixture).length, 0, 'Native checkout must not start');
  assert.equal(verifications(fixture).length, 0, 'An unstarted checkout must not trigger verification');
};
const assertPurchasedAndVerified = (fixture, expectedPackage) => {
  assert.equal(purchases(fixture).length, 1);
  assert.equal(purchases(fixture)[0].item, expectedPackage);
  assert.equal(verifications(fixture).length, 1);
  assert.equal(verifications(fixture)[0].name, 'sync-performance-subscription');
  assert.equal(JSON.stringify(verifications(fixture)[0].options), '{"body":{}}');
  assert.ok(fixture.calls.findIndex(({ type }) => type === 'purchase') < fixture.calls.findIndex(({ type }) => type === 'verify'));
};

test('live AUD checkout selects the requested exact package and verifies with the server', async () => {
  for (const period of ['monthly', 'annual']) {
    const fixture = checkout({ currencyCode: ' aud ' });
    await fixture.purchase(period);
    assertPurchasedAndVerified(fixture, fixture[period]);
    assert.equal(storefrontReads(fixture).length, 0);
  }
});

test('live foreign currency is rejected before native checkout', async () => {
  const fixture = checkout({ currencyCode: 'USD' });
  await assert.rejects(fixture.purchase(), /AUD price/);
  assertNotPurchased(fixture);
});

test('live checkout rejects absent or blank currency metadata', async () => {
  for (const currencyCode of [undefined, null, '', '   ']) {
    const fixture = checkout();
    fixture.monthly.product.currencyCode = currencyCode;
    await assert.rejects(fixture.purchase(), /AUD price|price currency/);
    assertNotPurchased(fixture);
  }
});

test('purchase-test flags cannot grant the foreign-currency exception outside isolated Apple review', async () => {
  for (const options of [
    { purchaseTest: true },
    { review: true, purchaseTest: true },
    { purchaseTest: true, appleReview: true },
    { review: true, appleReview: true },
  ]) {
    const fixture = checkout({ ...options, currencyCode: 'USD' });
    await assert.rejects(fixture.purchase(), /not open in this build|AUD price/);
    assertNotPurchased(fixture);
  }
});

test('Android foreign-currency checkout stays blocked in live and isolated test builds', async () => {
  for (const options of [{}, { review: true, purchaseTest: true, googleReview: true }]) {
    const fixture = checkout({ ...options, platform: 'android', currencyCode: 'USD' });
    await assert.rejects(fixture.purchase(), /AUD price/);
    assertNotPurchased(fixture);
    assert.equal(storefrontReads(fixture).length, 0);
  }
});

test('isolated Apple testing sends foreign metadata to native checkout and verifies with the server', async () => {
  for (const countryCode of ['AUS', ' au ']) {
    const fixture = checkout({ ...isolatedApple, currencyCode: 'USD', storefront: { countryCode } });
    await fixture.purchase('annual');
    assert.equal(storefrontReads(fixture).length, 0);
    assertPurchasedAndVerified(fixture, fixture.annual);
  }
});

test('unreliable native storefronts cannot block isolated Apple price loading or checkout', async () => {
  for (const storefront of [{ countryCode: 'USA' }, { countryCode: '' }, {}, null]) {
    const fixture = checkout({ ...isolatedApple, currencyCode: 'USD', storefront });
    assert.equal((await fixture.load()).applePurchaseTest, true);
    await fixture.purchase();
    assert.equal(storefrontReads(fixture).length, 0);
    assertPurchasedAndVerified(fixture, fixture.monthly);
  }
  const fixture = checkout({ ...isolatedApple, currencyCode: 'USD' });
  fixture.state.storefrontError = new Error('Storefront unavailable');
  assert.equal((await fixture.load()).applePurchaseTest, true);
  await fixture.purchase();
  assert.equal(storefrontReads(fixture).length, 0);
  assertPurchasedAndVerified(fixture, fixture.monthly);
});

test('isolated Apple AUD checkout does not require storefront diagnostics', async () => {
  const fixture = checkout({ ...isolatedApple });
  fixture.state.storefront = null;
  await fixture.purchase();
  assert.equal(storefrontReads(fixture).length, 0);
  assertPurchasedAndVerified(fixture, fixture.monthly);
});

test('isolated Apple checkout still rejects missing currency metadata', async () => {
  for (const currencyCode of [undefined, null, '', '   ']) {
    const fixture = checkout(isolatedApple);
    fixture.monthly.product.currencyCode = currencyCode;
    await assert.rejects(fixture.purchase(), /price currency/);
    assertNotPurchased(fixture);
  }
});

test('price loading exposes the Apple purchase-test marker only in the isolated iOS build', async () => {
  for (const options of [
    {}, { purchaseTest: true, appleReview: true },
    { platform: 'android', review: true, purchaseTest: true, googleReview: true },
  ]) {
    const fixture = checkout(options);
    const prices = await fixture.load();
    assert.equal(Object.hasOwn(prices, 'applePurchaseTest'), false);
    assert.equal(storefrontReads(fixture).length, 0);
    assertNotPurchased(fixture);
  }
  const fixture = checkout({ ...isolatedApple, currencyCode: 'USD' });
  const prices = await fixture.load();
  assert.equal(prices.applePurchaseTest, true);
  assert.equal(storefrontReads(fixture).length, 0);
  assert.equal(prices.monthly.productId, 'psi_performance_plus_monthly');
  assert.equal(prices.annual.productId, 'psi_performance_plus_annual');
  assert.equal(prices.monthly.currencyCode, 'USD', 'Store metadata must not be relabelled as AUD');
  assert.equal(prices.monthly.priceString, fixture.monthly.product.priceString);
  assertNotPurchased(fixture);
});

test('isolated Apple testing still requires a verified matching PSI account', async () => {
  for (const auth of [{ authUserId: null }, { authUserId: 'another-customer' }, { authError: new Error('Authentication failed') }]) {
    const fixture = checkout({ ...isolatedApple, currencyCode: 'USD' });
    Object.assign(fixture.state, auth);
    await assert.rejects(fixture.purchase(), /Sign into your PSI account/);
    assertNotPurchased(fixture);
    assert.equal(fixture.calls.length, 0, 'Unauthenticated checkout must not configure or call the native SDK');
  }
});

test('wrong monthly or annual product IDs block checkout even in isolated Apple testing', async () => {
  for (const wrongId of [{ monthlyId: 'unrelated_monthly' }, { annualId: 'unrelated_annual' }]) {
    const fixture = checkout({ ...isolatedApple, ...wrongId, currencyCode: 'USD' });
    await assert.rejects(fixture.purchase(), /wrong Performance\+ products/);
    assertNotPurchased(fixture);
  }
});

test('native user cancellation reports cancellation without invoking server verification', async () => {
  for (const mode of [{}, { ...isolatedApple, currencyCode: 'USD', storefront: null }]) {
    const fixture = checkout({ ...mode, purchaseError: { userCancelled: true } });
    await assert.rejects(fixture.purchase(), /Purchase cancelled/);
    assert.equal(purchases(fixture).length, 1);
    assert.equal(verifications(fixture).length, 0);
  }
});

test('failed server verification never retries the native purchase and directs the customer to Restore', async () => {
  for (const mode of [{}, { ...isolatedApple, currencyCode: 'USD', storefront: null }]) {
    for (const options of [{ verified: false }, { verificationError: new Error('Verification unavailable') }]) {
      const fixture = checkout({ ...mode, ...options });
      await assert.rejects(fixture.purchase(), /Restore purchases; do not purchase again/);
      assertPurchasedAndVerified(fixture, fixture.monthly);
    }
  }
});
