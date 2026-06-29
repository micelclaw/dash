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
// `guided` (por defecto) muestra la narrativa en lenguaje humano y
// mantiene el detalle técnico (el iframe de OpenCode, tool-calls, código)
// tras una cortina. `pro` descorre la cortina. Persistido en localStorage
// para que la elección del usuario sobreviva entre sesiones. Hook simple
// (una sola instancia lo consume hoy — el panel de Build).

import { useCallback, useState } from 'react';

export type StudioMode = 'guided' | 'pro';

const KEY = 'claw-studio-mode';

export function useStudioMode(): [StudioMode, (m: StudioMode) => void] {
  const [mode, setModeState] = useState<StudioMode>(() => {
    try {
      return localStorage.getItem(KEY) === 'pro' ? 'pro' : 'guided';
    } catch {
      return 'guided';
    }
  });

  const setMode = useCallback((m: StudioMode) => {
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* private mode / quota */ }
  }, []);

  return [mode, setMode];
}
