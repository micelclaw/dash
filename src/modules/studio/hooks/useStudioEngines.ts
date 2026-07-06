/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── useStudioEngines — shared engine list + live readiness ─────────
//
// Single hook behind every surface that needs the engine list (create
// picker, Build settings, degradation banner, Settings grid). Fetches
// GET /studio/engines on mount and REFRESHES on window focus /
// visibilitychange — so "Configure → set the API key → come back" flips
// the card to Ready without a remount (engine gap 7).

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { StudioEngineId, StudioEngineInfo } from '@/stores/studio.store';

interface EnginesResponse { engines: StudioEngineInfo[]; default_engine: StudioEngineId }

export function useStudioEngines(): {
  engines: StudioEngineInfo[];
  defaultEngine: StudioEngineId;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [engines, setEngines] = useState<StudioEngineInfo[]>([]);
  const [defaultEngine, setDefaultEngine] = useState<StudioEngineId>('opencode');
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await api.get<{ data: EnginesResponse }>('/studio/engines');
      const list = res.data.engines ?? [];
      if (list.length) setEngines(list);
      if (res.data.default_engine) setDefaultEngine(res.data.default_engine);
    } catch {
      /* Core unreachable / old Core → callers fall back to OpenCode-only. */
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return { engines, defaultEngine, loading, refresh };
}

export default useStudioEngines;
