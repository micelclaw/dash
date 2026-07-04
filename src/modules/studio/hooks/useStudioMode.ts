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

// ─── Studio v3 — Modo Guiado / Pro (divulgación progresiva, D5) ─────
//
// `guided` (default) shows the human-language narrative and keeps the
// technical detail (the OpenCode iframe, tool-calls, code) behind a curtain.
// `pro` pulls the curtain. Persisted in localStorage so the choice survives
// across sessions.
//
// M9: this is now a SHARED external store (useSyncExternalStore) rather than
// per-hook useState. Multiple components read the mode (detail page, phases,
// the build embed); with local state a flip in one place left the others on
// the stale mode. All instances now share one value in the tab AND react to
// changes made in another tab (the `storage` event).

import { useCallback, useSyncExternalStore } from 'react';

export type StudioMode = 'guided' | 'pro';

const KEY = 'claw-studio-mode';

function read(): StudioMode {
  try {
    return localStorage.getItem(KEY) === 'pro' ? 'pro' : 'guided';
  } catch {
    return 'guided';
  }
}

let current: StudioMode = read();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

// One global cross-tab sync (registered once at import).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      const v = read();
      if (v !== current) { current = v; emit(); }
    }
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): StudioMode {
  return current;
}

export function useStudioMode(): [StudioMode, (m: StudioMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => 'guided' as StudioMode);
  const setMode = useCallback((m: StudioMode) => {
    if (m === current) return;
    current = m;
    try { localStorage.setItem(KEY, m); } catch { /* private mode / quota */ }
    emit();
  }, []);
  return [mode, setMode];
}
