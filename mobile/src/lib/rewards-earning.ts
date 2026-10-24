export type RewardsEarning = {
  multiplier: 1 | 2;
  state: 'standard' | 'double' | 'unavailable';
  subscriptionStatus: 'free' | 'trial' | 'active' | 'expired' | 'permanent' | 'unavailable';
  bonusEnabled: boolean;
  validUntil: string | null;
  subscriptionExpiresAt: string | null;
  verifiedAt: string | null;
  serverTime: string | null;
  complimentaryDouble?: boolean;
};

export function readRewardsEarning(input: unknown): RewardsEarning {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  const subscriptionStatus = ['free', 'trial', 'active', 'expired', 'permanent'].includes(String(value.subscriptionStatus))
    ? value.subscriptionStatus as RewardsEarning['subscriptionStatus'] : 'unavailable';
  const serverTime = date(value.serverTime);
  const validUntil = date(value.validUntil);
  const verifiedAt = date(value.verifiedAt);
  const complimentaryDouble = value.complimentaryDouble === true && subscriptionStatus === 'permanent';
  const double = value.multiplier === 2 && value.state === 'double' && value.bonusEnabled === true
    && !!serverTime && !!verifiedAt && Date.parse(verifiedAt) <= Date.parse(serverTime)
    && (complimentaryDouble && (!validUntil || Date.parse(validUntil) > Date.parse(serverTime))
      || subscriptionStatus === 'active' && !!validUntil && Date.parse(validUntil) > Date.parse(serverTime));
  return {
    multiplier: double ? 2 : 1, state: double ? 'double' : value.state === 'standard' ? 'standard' : 'unavailable',
    subscriptionStatus, bonusEnabled: value.bonusEnabled === true, validUntil: double ? validUntil : null,
    subscriptionExpiresAt: date(value.subscriptionExpiresAt), verifiedAt, serverTime,
    complimentaryDouble: double && complimentaryDouble,
  };
}

// Display only. Financial earning remains a trusted backend calculation.
export function rewardsEarningAt(value: RewardsEarning, now: number): RewardsEarning {
  const expired = value.subscriptionStatus !== 'permanent' && !!value.subscriptionExpiresAt
    && Date.parse(value.subscriptionExpiresAt) <= now;
  const doubleEnded = value.multiplier === 2 && (!value.validUntil ? !value.complimentaryDouble : Date.parse(value.validUntil) <= now);
  const stale = value.multiplier === 2 && (!value.serverTime || now >= Date.parse(value.serverTime) + 5 * 60_000);
  return { ...value,
    multiplier: expired || doubleEnded || stale ? 1 : value.multiplier,
    state: stale ? 'unavailable' : expired || doubleEnded ? 'standard' : value.state,
    subscriptionStatus: expired ? 'expired' : value.subscriptionStatus,
  };
}

export function rewardsSubscriptionLabel(earning: RewardsEarning) {
  switch (earning.subscriptionStatus) {
    case 'trial': return 'TRIAL ACTIVE · 1× POINTS';
    case 'permanent': return `PERMANENT ACCESS · ${earning.multiplier === 2 ? 2 : 1}× POINTS`;
    case 'expired': return 'PERFORMANCE+ EXPIRED';
    case 'active': return 'PERFORMANCE+ ACTIVE';
    case 'free': return 'PSI FREE REWARDS';
    default: return 'PSI REWARDS';
  }
}

export function rewardsWalletProviders(platform: string, userAgent = '', touchPoints = 0): ('apple' | 'google')[] {
  if (platform === 'ios' || platform === 'web' && (/iPhone|iPad|iPod/iu.test(userAgent) || /Macintosh/iu.test(userAgent) && touchPoints > 1)) return ['apple'];
  if (platform === 'android' || platform === 'web' && /Android/iu.test(userAgent)) return ['google'];
  return ['apple', 'google'];
}
