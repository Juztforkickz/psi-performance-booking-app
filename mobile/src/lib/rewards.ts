import { getSupabaseClient } from '@/lib/supabase';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export type RewardsEntry = { id: string; invoice_number: string; points_change: number; kind: 'earned' | 'adjustment' | 'redeemed' | 'credit_restored'; created_at: string };
export type RewardsAccount = {
  name: string; points: number; creditCents: number; cardId: string; qr: string; updatedAt: string;
  wallet: { apple: boolean; google: boolean }; walletStatus?: { appleConnected: boolean | null }; ledger: RewardsEntry[];
};
export const formatRewardsCredit = (cents: number) => `AUD ${(Math.max(0, cents) / 100).toFixed(2)}`;
export const formatRewardsPoints = (points: number) => Math.max(0, points).toLocaleString('en-AU');

async function requestRewards(body: Record<string, unknown>) {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('REWARDS_NOT_AVAILABLE_IN_REVIEW');
  const client = getSupabaseClient();
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user) throw new Error('REWARDS_SIGN_IN_REQUIRED');
  const { data, error } = await client.functions.invoke('rewards-wallet', { body });
  if (error) throw new Error('Your rewards could not be refreshed. Please try again shortly.');
  if (data?.error) throw new Error('Your rewards could not be refreshed. Please try again shortly.');
  return data;
}
export async function loadRewardsAccount(): Promise<RewardsAccount> {
  const data = await requestRewards({ action: 'summary' });
  if (!Number.isSafeInteger(data?.points) || data.creditCents !== Math.max(0, data.points)
    || typeof data.cardId !== 'string' || !/^data:image\/png;base64,/u.test(data.qr ?? '') || !Array.isArray(data.ledger)) {
    throw new Error('Your rewards balance could not be verified. Please refresh.');
  }
  return { ...data, ledger: data.ledger.map((entry: RewardsEntry) => ({ ...entry, points_change: Number(entry.points_change) })) };
}
export async function prepareRewardsWallet(provider: 'apple' | 'google'): Promise<string> {
  const data = await requestRewards({ action: provider });
  const url = new URL(data?.url ?? '');
  const valid = provider === 'apple'
    ? url.origin === 'https://lslhfrujyuqcavsnugfx.supabase.co' && /^\/functions\/v1\/rewards-wallet\/download\/[a-f0-9]{64}$/u.test(url.pathname)
    : url.origin === 'https://pay.google.com' && url.pathname.startsWith('/gp/v/save/');
  if (!valid || url.protocol !== 'https:') throw new Error('The Wallet card could not be prepared. Please try again.');
  return url.href;
}
export function rewardsCardId(value: string) {
  const input = value.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  if (uuid.test(input)) return input;
  if (/^[0-9a-f]{8}$/iu.test(input)) return input.toLowerCase();
  try {
    const url = new URL(input);
    if (url.origin === 'https://juztforkickz.github.io' && url.pathname === '/psi-performance-booking-app/rewards-scan/' && uuid.test(url.hash.slice(1))) return url.hash.slice(1);
  } catch { /* A code may be pasted without a URL. */ }
  throw new Error('Open or paste a valid PSI Rewards card code.');
}
export async function lookupRewardsCard(value: string): Promise<{ name: string; points: number; creditCents: number; cardId: string }> {
  const data = await requestRewards({ action: 'staff_lookup', cardId: rewardsCardId(value) });
  if (!Number.isSafeInteger(data?.points) || data.creditCents !== Math.max(0, data.points)) throw new Error('This rewards balance could not be verified.');
  return data;
}
export async function loadRewardsStaffStatus(): Promise<{ enabled: boolean; startsOn: string; processing: number; held: number; wallet: { apple: boolean; google: boolean } }> {
  return await requestRewards({ action: 'staff_status' });
}
