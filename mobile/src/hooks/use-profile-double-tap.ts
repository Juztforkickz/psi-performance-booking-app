import { useEffect, useRef } from 'react';

export function useProfileDoubleTap(singleTap: () => void, doubleTap: () => void, enabled: boolean) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actions = useRef({ singleTap, doubleTap });
  useEffect(() => { actions.current = { singleTap, doubleTap }; }, [singleTap, doubleTap]);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);
  return () => {
    if (!enabled) { actions.current.singleTap(); return; }
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
      actions.current.doubleTap();
      return;
    }
    pending.current = setTimeout(() => {
      pending.current = null;
      actions.current.singleTap();
    }, 320);
  };
}
