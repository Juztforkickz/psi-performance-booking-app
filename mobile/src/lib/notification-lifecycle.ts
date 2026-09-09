/** Invalidates an in-flight read when a newer read, local update or account change wins. */
export function createNotificationRequestScope() {
  let active = false;
  let revision = 0;
  return {
    open() { active = true; },
    close() { active = false; revision += 1; },
    isActive() { return active; },
    invalidate() { revision += 1; },
    begin() {
      const requestRevision = ++revision;
      return () => active && requestRevision === revision;
    },
  };
}

/** The native cold-start response and live listener can deliver the same tap. */
export function createNotificationResponseTracker() {
  const handled = new Set<string>();
  return {
    consume(requestId: string, actionId: string) {
      const key = JSON.stringify([requestId, actionId]);
      if (handled.has(key)) return false;
      handled.add(key);
      if (handled.size > 100) handled.delete(handled.values().next().value!);
      return true;
    },
  };
}
