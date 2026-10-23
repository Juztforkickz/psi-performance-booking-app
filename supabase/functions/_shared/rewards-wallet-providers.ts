import { Buffer } from 'node:buffer';
import { PKPass } from 'npm:passkit-generator@3.5.7';
import { env } from './xero-runtime.ts';
import type { RewardsEarning } from './rewards-earning.ts';

export type RewardsCard = { customer_id: string; card_id: string; points_balance: number; revision: number; updated_at: string; name: string; earning?: RewardsEarning };
export const REWARDS_SITE = 'https://juztforkickz.github.io/psi-performance-booking-app';
export const creditLabel = (points: number) => `AUD ${(Math.max(0, Number(points)) / 100).toFixed(2)}`;
export const scanUrl = (card: Pick<RewardsCard, 'card_id'>) => `${REWARDS_SITE}/rewards-scan/#${card.card_id}`;
export const walletConfiguration = () => ({
  apple: ['REWARDS_APPLE_PASS_TYPE_ID','REWARDS_APPLE_TEAM_ID','REWARDS_APPLE_CERT_PEM','REWARDS_APPLE_KEY_PEM','REWARDS_APPLE_WWDR_PEM'].every(key => Boolean(env(key))),
  google: Boolean(env('REWARDS_GOOGLE_ISSUER_ID') && env('REWARDS_GOOGLE_SERVICE_ACCOUNT') && env('REWARDS_GOOGLE_PUBLISHING_ENABLED') === 'true'),
});

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const pem = (value: string) => value.replace(/\\n/gu, '\n');
const privateKeyBytes = (value: string) => Uint8Array.from(atob(pem(value).replace(/-----[^-]+-----/gu, '').replace(/\s/gu, '')), character => character.charCodeAt(0));
async function signJwt(payload: Record<string, unknown>, account: { private_key: string }) {
  const key = await crypto.subtle.importKey('pkcs8', privateKeyBytes(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const input = `${b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64url(new TextEncoder().encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(signature))}`;
}
function googleConfig() {
  if (!walletConfiguration().google) throw new Error('google_wallet_setup_required');
  const issuer = env('REWARDS_GOOGLE_ISSUER_ID');
  const account = JSON.parse(env('REWARDS_GOOGLE_SERVICE_ACCOUNT')) as { client_email: string; private_key: string };
  if (!/^\d{6,30}$/u.test(issuer) || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/u.test(account.client_email) || !account.private_key) throw new Error('google_wallet_setup_required');
  return { issuer, account, classId: `${issuer}.psi_rewards_v1` };
}
async function googleAccess() {
  const config = googleConfig();
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({ iss: config.account.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }, config.account);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') throw new Error('google_wallet_access_unavailable');
  return { ...config, token: result.access_token as string };
}
function objectBody(card: RewardsCard, issuer: string, classId: string) {
  const earning = walletEarning(card);
  return { id: `${issuer}.psi_rewards_${card.card_id.replace(/-/gu, '')}`, classId, state: 'ACTIVE', accountName: card.name,
    accountId: card.card_id.slice(0, 8).toUpperCase(), hexBackgroundColor: '#090B0E',
    loyaltyPoints: { label: 'Points', balance: { int: Math.max(0, Number(card.points_balance)) } },
    secondaryLoyaltyPoints: { label: 'Workshop credit', balance: { string: creditLabel(card.points_balance) } },
    barcode: { type: 'QR_CODE', value: scanUrl(card), alternateText: card.card_id.slice(0, 8).toUpperCase() },
    textModulesData: [{ id: 'membership', header: earning.label, body: earning.details },
      { id: 'rate', header: 'Workshop credit', body: '1,000 points = AUD 10 workshop credit. Your earned points stay yours when Performance+ ends.' }],
    linksModuleData: { uris: [{ uri: `${REWARDS_SITE}/rewards/`, description: 'Open PSI Rewards', id: 'psi_rewards' }] },
  };
}
export function walletEarning(card: RewardsCard) {
  const earning = card.earning;
  if (earning?.state === 'unavailable') return { label: 'CHECK IN APP', until: null,
    details: 'Your points and workshop credit are available. Open PSI Rewards to check your current earning rate.' };
  const double = earning?.multiplier === 2 && earning.state === 'double' && earning.bonusEnabled
    && earning.subscriptionStatus === 'active' && !!earning.validUntil && Date.parse(earning.validUntil) > Date.now();
  const until = double ? earning.validUntil : null;
  return { label: double ? '2× POINTS ACTIVE' : '1× POINTS', until,
    details: double ? `Paid Performance+. Earn 2 points per AUD 1 of qualifying eligible spending. Paid rate until ${new Date(until!).toISOString()}.`
      : 'PSI Free Rewards. Earn 1 point per AUD 1 of eligible paid invoice spending. Free loyalty membership, including complimentary Performance+ access.' };
}
export async function issueGoogleCard(card: RewardsCard) {
  const config = await googleAccess();
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };
  const base = 'https://walletobjects.googleapis.com/walletobjects/v1';
  const existingClass = await fetch(`${base}/loyaltyClass/${config.classId}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!existingClass.ok) { await existingClass.body?.cancel(); throw new Error('google_wallet_class_setup_required'); }
  const passClass = await existingClass.json();
  // The live REST API also returns the legacy lower case enum spelling.
  if (String(passClass.reviewStatus ?? '').toUpperCase() !== 'APPROVED') throw new Error('google_wallet_publishing_approval_required');
  const object = objectBody(card, config.issuer, config.classId);
  const response = await fetch(`${base}/loyaltyObject`, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(15000), body: JSON.stringify(object) });
  if (response.status === 409) {
    await response.body?.cancel();
    const updated = await fetch(`${base}/loyaltyObject/${object.id}`, { method: 'PATCH', headers, redirect: 'error', signal: AbortSignal.timeout(15000), body: JSON.stringify(object) });
    await updated.body?.cancel(); if (!updated.ok) throw new Error('google_wallet_update_unavailable');
  } else { await response.body?.cancel(); if (!response.ok) throw new Error('google_wallet_issue_unavailable'); }
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt({ iss: config.account.client_email, aud: 'google', typ: 'savetowallet', iat: now, exp: now + 3600,
    origins: ['https://juztforkickz.github.io'], payload: { loyaltyObjects: [{ id: object.id }] } }, config.account);
  return { objectId: object.id, url: `https://pay.google.com/gp/v/save/${jwt}` };
}
export async function updateGoogleCard(card: RewardsCard, objectId: string) {
  const config = await googleAccess();
  const object = objectBody(card, config.issuer, config.classId);
  if (object.id !== objectId) throw new Error('wallet_identity_requires_review');
  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${object.id}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(15000), body: JSON.stringify(object),
  });
  await response.body?.cancel(); if (!response.ok) throw new Error('google_wallet_update_unavailable');
}

async function imageAsset(name: string) {
  const response = await fetch(`${REWARDS_SITE}/rewards-assets/${name}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) throw new Error('wallet_artwork_unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 2_000_000 || bytes[0] !== 137 || bytes[1] !== 80) throw new Error('wallet_artwork_invalid');
  return bytes;
}
export async function applePass(card: RewardsCard, authToken: string) {
  if (!walletConfiguration().apple) throw new Error('apple_wallet_setup_required');
  const [logo, icon] = await Promise.all([imageAsset('logo.png'), imageAsset('icon.png')]);
  const pass = new PKPass({ 'logo.png': logo, 'icon.png': icon }, {
    wwdr: pem(env('REWARDS_APPLE_WWDR_PEM')), signerCert: pem(env('REWARDS_APPLE_CERT_PEM')), signerKey: pem(env('REWARDS_APPLE_KEY_PEM')),
    ...(env('REWARDS_APPLE_KEY_PASSWORD') ? { signerKeyPassphrase: env('REWARDS_APPLE_KEY_PASSWORD') } : {}),
  }, {
    formatVersion: 1, passTypeIdentifier: env('REWARDS_APPLE_PASS_TYPE_ID'), teamIdentifier: env('REWARDS_APPLE_TEAM_ID'),
    serialNumber: card.card_id, organizationName: 'PSI Performance', description: 'PSI Rewards loyalty card',
    logoText: 'PSI Rewards', backgroundColor: 'rgb(9, 11, 14)', foregroundColor: 'rgb(255, 255, 255)', labelColor: 'rgb(101, 207, 248)',
    webServiceURL: `${env('SUPABASE_URL')}/functions/v1/rewards-wallet/apple`, authenticationToken: authToken,
  });
  pass.type = 'storeCard';
  const earning = walletEarning(card);
  pass.headerFields.push({ key: 'earning', label: 'EARNING RATE', value: earning.label });
  pass.primaryFields.push({ key: 'credit', label: 'WORKSHOP CREDIT', value: creditLabel(card.points_balance), changeMessage: 'Your PSI workshop credit is now %@.' });
  pass.secondaryFields.push({ key: 'points', label: 'POINTS', value: Math.max(0, Number(card.points_balance)) });
  pass.auxiliaryFields.push({ key: 'member', label: 'MEMBER', value: card.name });
  pass.backFields.push({ key: 'membership', label: earning.label, value: earning.details },
    { key: 'rate', label: 'PSI Rewards', value: '1,000 points = AUD 10 workshop credit. Your earned points stay yours when Performance+ ends.' },
    { key: 'account', label: 'Your rewards', value: `${REWARDS_SITE}/rewards/` });
  pass.setBarcodes({ message: scanUrl(card), format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' });
  return pass.getAsBuffer();
}

export async function pushApplePass(pushToken: string) {
  if (!/^[0-9a-f]{32,256}$/iu.test(pushToken) || !walletConfiguration().apple) throw new Error('apple_wallet_push_configuration_required');
  const client = Deno.createHttpClient({ cert: pem(env('REWARDS_APPLE_CERT_PEM')), key: pem(env('REWARDS_APPLE_KEY_PEM')) });
  try {
    const response = await fetch(`https://api.push.apple.com/3/device/${pushToken}`, { client, method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'apns-topic': env('REWARDS_APPLE_PASS_TYPE_ID'), 'apns-priority': '5', 'Content-Type': 'application/json' }, body: '{}' });
    await response.body?.cancel();
    if (response.status === 410) return 'removed' as const;
    if (!response.ok) throw new Error('apple_wallet_update_unavailable');
    return 'sent' as const;
  } finally { client.close(); }
}
