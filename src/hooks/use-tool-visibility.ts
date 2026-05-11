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

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_VISIBILITY, type ToolVisibility, type Preset } from '@/config/tool-rendering';

const LS_KEY = 'claw-tool-visibility';

function readFromStorage(): ToolVisibility {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(raw) as ToolVisibility;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_VISIBILITY;
    if (!['minimal', 'default', 'verbose', 'custom'].includes(parsed.preset)) return DEFAULT_VISIBILITY;
    return parsed;
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

function writeToStorage(v: ToolVisibility): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/**
 * Cross-tab pub/sub for tool visibility changes. Updating from one
 * tab will refresh the value in all other open tabs.
 */
const listeners = new Set<(v: ToolVisibility) => void>();
function notify(v: ToolVisibility) {
  for (const fn of listeners) fn(v);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) notify(readFromStorage());
  });
}

export function useToolVisibility(): {
  visibility: ToolVisibility;
  setPreset: (p: Preset) => void;
  toggleTool: (name: string, enabled: boolean) => void;
  reset: () => void;
} {
  const [visibility, setVisibility] = useState<ToolVisibility>(() => readFromStorage());

  useEffect(() => {
    const fn = (v: ToolVisibility) => setVisibility(v);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const persist = useCallback((v: ToolVisibility) => {
    writeToStorage(v);
    setVisibility(v);
    notify(v);
  }, []);

  const setPreset = useCallback((p: Preset) => {
    persist({ ...visibility, preset: p });
  }, [persist, visibility]);

  const toggleTool = useCallback((name: string, enabled: boolean) => {
    const lower = name.toLowerCase();
    const enabledOverrides = new Set(visibility.enabledOverrides ?? []);
    const disabledOverrides = new Set(visibility.disabledOverrides ?? []);
    if (enabled) {
      enabledOverrides.add(lower);
      disabledOverrides.delete(lower);
    } else {
      disabledOverrides.add(lower);
      enabledOverrides.delete(lower);
    }
    persist({
      ...visibility,
      preset: 'custom',
      enabledOverrides: Array.from(enabledOverrides),
      disabledOverrides: Array.from(disabledOverrides),
    });
  }, [persist, visibility]);

  const reset = useCallback(() => persist(DEFAULT_VISIBILITY), [persist]);

  return { visibility, setPreset, toggleTool, reset };
}
