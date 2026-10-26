export type AndroidUpdatePhase = 'disabled' | 'idle' | 'checking' | 'downloading' | 'current' | 'ready' | 'applying' | 'error';
export type AndroidUpdateState = { phase: AndroidUpdatePhase; checkedAt: number | null; pendingId: string | null; error: string | null };
export type AndroidUpdateAdapter = {
  enabled: boolean; runningId: string | null;
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean; reason?: string }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean; manifest?: { id?: string } }>;
  reload: () => Promise<void>;
  readAttempt: () => Promise<string | null>;
  writeAttempt: (value: string) => Promise<void>;
  now?: () => number;
};

/** Only the native updater chooses and validates releases. No URL/channel overrides. */
export function createAndroidUpdateController(adapter: AndroidUpdateAdapter) {
  const now = adapter.now ?? Date.now;
  let state: AndroidUpdateState = { phase: adapter.enabled ? 'idle' : 'disabled', checkedAt: null, pendingId: null, error: null };
  let checking: Promise<void> | null = null;
  let applying: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<AndroidUpdateState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check(force = false): Promise<void> {
      if (!adapter.enabled || applying) return Promise.resolve();
      if (checking) return checking;
      if (state.pendingId || (!force && state.checkedAt !== null && now() - state.checkedAt < 120_000)) return Promise.resolve();
      update({ phase: 'checking', error: null });
      checking = (async () => {
        try {
          const result = await adapter.check();
          if (!result.isAvailable && !result.isRollBackToEmbedded) {
            const rejected = result.reason === 'updatePreviouslyFailed' || result.reason === 'updateRejectedBySelectionPolicy';
            update({ phase: rejected ? 'error' : 'current', error: rejected ? 'update_requires_review' : null, checkedAt: now() });
            return;
          }
          update({ phase: 'downloading' });
          const fetched = await adapter.fetch();
          const id = fetched.isRollBackToEmbedded ? 'embedded' : fetched.isNew ? fetched.manifest?.id : null;
          if (!id || id === adapter.runningId) { update({ phase: 'current', checkedAt: now() }); return; }
          update({ phase: 'ready', pendingId: id, checkedAt: now() });
        } catch { update({ phase: 'error', error: 'update_connection_or_download_failed', checkedAt: now() }); }
      })().finally(() => { checking = null; });
      return checking;
    },
    apply(canReload: () => boolean): Promise<void> {
      if (applying) return applying;
      if (!adapter.enabled || !state.pendingId || !canReload()) return Promise.resolve();
      const target = state.pendingId;
      applying = (async () => {
        try {
          let previous: { id?: string; at?: number } | null = null;
          try { previous = JSON.parse(await adapter.readAttempt() ?? 'null'); } catch { /* Invalid marker is not authority to clear any storage. */ }
          if (previous?.id === target && typeof previous.at === 'number' && now() - previous.at >= 0 && now() - previous.at < 300_000) {
            update({ phase: 'error', error: 'update_restart_requires_review' }); return;
          }
          if (!canReload()) return;
          await adapter.writeAttempt(JSON.stringify({ id: target, at: now() }));
          // A booking can open or the startup deadline can expire during storage I/O.
          if (!canReload()) return;
          update({ phase: 'applying', error: null });
          await adapter.reload();
        } catch { update({ phase: 'error', error: 'update_restart_failed' }); }
      })().finally(() => { applying = null; });
      return applying;
    },
  };
}
