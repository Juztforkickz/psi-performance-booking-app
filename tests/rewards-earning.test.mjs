import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { readRewardsEarning, rewardsEarningAt, rewardsSubscriptionLabel, rewardsWalletProviders } from '../mobile/src/lib/rewards-earning.ts';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const backendSource = ts.transpileModule(await readFile(new URL('../supabase/functions/_shared/rewards-earning.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const backend = {};
vm.runInNewContext(backendSource, { exports: backend, Date, require: () => ({ env: name => ({
  PERFORMANCE_APPLE_PRODUCT_IDS: 'psi_performance_plus_monthly,psi_performance_plus_annual',
  PERFORMANCE_GOOGLE_PRODUCT_IDS: 'psi_performance_plus:monthly,psi_performance_plus:annual',
})[name] ?? '' }) });
const customer = '10000000-0000-4000-8000-000000000001';
const now = Date.parse('2026-10-23T00:00:00Z');
const proof = { customer_id: customer, multiplier: 2, bonus_enabled: true, paid_period_verified: true,
  subscription_status: 'active', environment: 'production', store: 'app_store', product_id: 'psi_performance_plus_monthly',
  server_time: new Date(now).toISOString(), verified_at: new Date(now - 1000).toISOString(),
  valid_until: new Date(now + 60_000).toISOString(), subscription_expires_at: new Date(now + 60_000).toISOString() };
const interpret = data => backend.rewardsEarningFor({ rpc: async () => ({ data }) }, customer);

test('an explicit server verified permanent double grant needs no paid receipt and retains refresh expiry safeguards',async()=>{
  const earning=await interpret({...proof,subscription_status:'permanent',paid_period_verified:false,
    complimentary_double_verified:true,valid_until:null,subscription_expires_at:null});
  assert.equal(earning.multiplier,2);assert.equal(earning.complimentaryDouble,true);
  const display=readRewardsEarning(earning);assert.equal(display.multiplier,2);
  assert.equal(rewardsEarningAt(display,now+60_000).multiplier,2);
  assert.equal(rewardsEarningAt(display,now+6*60_000).state,'unavailable');
  assert.equal(rewardsSubscriptionLabel(display),'PERMANENT ACCESS · 2× POINTS');
  for(const override of [{complimentary_double_verified:false},{subscription_status:'free'},{bonus_enabled:false},{valid_until:new Date(now-1).toISOString()}]){
    assert.equal((await interpret({...proof,subscription_status:'permanent',paid_period_verified:false,complimentary_double_verified:true,valid_until:null,...override})).multiplier,1);
  }
});

test('free, complimentary trial, permanent and expired memberships retain standard earning', async () => {
  for (const status of ['free','trial','permanent','expired']) {
    const earning = await interpret({ ...proof, subscription_status: status });
    assert.equal(earning.multiplier, 1);
    assert.equal(earning.subscriptionStatus, status);
  }
});
test('verified production paid monthly and annual products on either store can display double', async () => {
  for (const [store, products] of [['app_store',['psi_performance_plus_monthly','psi_performance_plus_annual']],
    ['play_store',['psi_performance_plus:monthly','psi_performance_plus:annual']]]) {
    for (const product_id of products) assert.equal((await interpret({ ...proof, store, product_id })).multiplier, 2);
  }
});
test('unpaid, stale, sandbox, wrong customer, unknown product and disabled policy cannot claim double', async () => {
  for (const override of [{ paid_period_verified: false }, { bonus_enabled: false }, { environment: 'sandbox' },
    { customer_id: 'another-customer' }, { product_id: 'unrelated_purchase' }, { store: 'promotional' },
    { verified_at: null }, { verified_at: new Date(now + 1000).toISOString() }, { server_time: null },
    { valid_until: new Date(now).toISOString() }]) assert.equal((await interpret({ ...proof, ...override })).multiplier, 1);
});
test('provider failure does not remove access to existing balance or invent paid status', async () => {
  assert.equal((await backend.rewardsEarningFor({ rpc: async () => { throw new Error('unavailable'); } }, customer)).multiplier, 1);
  assert.equal((await interpret(null)).subscriptionStatus, 'unavailable');
});
test('open screen changes paid earning to standard at expiry, and verified renewal restores it', async () => {
  const earning = readRewardsEarning(await interpret(proof));
  assert.equal(rewardsEarningAt(earning, now).multiplier, 2);
  const expired = rewardsEarningAt(earning, now + 60_000);
  assert.equal(expired.multiplier, 1);
  assert.equal(expired.subscriptionStatus, 'expired');
  const renewed = readRewardsEarning(await interpret({ ...proof, server_time: new Date(now + 60_000).toISOString(),
    valid_until: new Date(now + 120_000).toISOString(), subscription_expires_at: new Date(now + 120_000).toISOString() }));
  assert.equal(rewardsEarningAt(renewed, now + 60_000).multiplier, 2);
});
test('offline stale verification cannot keep a double indicator indefinitely', async () => {
  const earning = readRewardsEarning(await interpret({ ...proof, valid_until: new Date(now + 86400_000).toISOString(), subscription_expires_at: new Date(now + 86400_000).toISOString() }));
  assert.equal(rewardsEarningAt(earning, now + 300_000).multiplier, 1);
  assert.equal(rewardsEarningAt(earning, now + 300_000).state, 'unavailable');
});
test('subscription and earning deadlines are separate, so paid expiry does not cancel premium grace', async () => {
  const earning = readRewardsEarning(await interpret({ ...proof, subscription_expires_at: new Date(now + 120_000).toISOString() }));
  assert.equal(rewardsEarningAt(earning, now + 60_000).multiplier, 1);
  assert.equal(rewardsEarningAt(earning, now + 60_000).subscriptionStatus, 'active');
});
test('missing legacy response is safe and complimentary labels remain truthful', () => {
  assert.equal(readRewardsEarning(undefined).multiplier, 1);
  assert.equal(readRewardsEarning({ ...proof, multiplier: 2 }).multiplier, 1);
  assert.match(rewardsSubscriptionLabel({ subscriptionStatus: 'trial' }), /TRIAL ACTIVE.*1×/);
  assert.match(rewardsSubscriptionLabel({ subscriptionStatus: 'permanent' }), /PERMANENT ACCESS.*1×/);
});
test('native and mobile web Wallet choices match the device, desktop offers both', () => {
  for (const args of [['ios'],['web','iPhone'],['web','Macintosh',5]]) assert.deepEqual(rewardsWalletProviders(...args), ['apple']);
  for (const args of [['android'],['web','Android']]) assert.deepEqual(rewardsWalletProviders(...args), ['google']);
  assert.deepEqual(rewardsWalletProviders('web','Windows'), ['apple','google']);
});
