export type PerformanceStatusInput = {
  plan: 'free' | 'history_import' | 'performance_plus';
  expires_at: string | null;
  is_permanent: boolean;
  is_trial: boolean;
  status?: 'active' | 'trial' | 'permanent' | 'expired' | 'free';
  history_import_access?: boolean;
};
export function performanceStatus(value: PerformanceStatusInput | null, now = Date.now()) {
  const active = value?.plan === 'performance_plus' &&
    (value.is_permanent || !!value.expires_at && Date.parse(value.expires_at) > now);
  const permanent = !!active && !!value?.is_permanent;
  const trial = !!active && !permanent && !!value?.is_trial;
  const expired = !active && (value?.status === 'expired' || !!value?.expires_at && Date.parse(value.expires_at) <= now);
  return { active: !!active, permanent, trial,
    records: !!active || value?.plan === 'history_import' || value?.history_import_access === true,
    label: !value ? 'CHECKING ACCESS' : permanent ? 'PERMANENT ACCESS' : trial ? 'TRIAL ACTIVE' : active ? 'ACTIVE' : expired ? 'FREE / EXPIRED' : 'FREE' };
}

// Local listeners invalidate every mounted plan screen after server verification.
const listeners = new Set<() => void>();
export function onPerformanceChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function performanceChanged() { for (const listener of listeners) listener(); }
