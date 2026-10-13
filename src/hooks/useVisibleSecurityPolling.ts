import { useEffect, type RefObject } from 'react';

/** Serial polling of observations only. It never hydrates a policy editor. */
export function useVisibleSecurityPolling(root: RefObject<HTMLElement | null>, refresh: (isCurrent: () => boolean) => Promise<void>) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!document.hidden && root.current?.getClientRects().length) {
        try { await refresh(() => !cancelled); } catch { /* caller owns its visible error state */ }
      }
      if (!cancelled) timer = setTimeout(() => { void tick(); }, 5_000);
    };
    timer = setTimeout(() => { void tick(); }, 5_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [root, refresh]);
}
