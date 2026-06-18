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

// ─── useEmbedFullscreen ──────────────────────────────────────────────
// Estado de "pantalla completa in-page" para los módulos que embeben una app.
// `rootStyle` se spreadea en el root del embebido SOLO cuando fullscreen
// (override condicional → no toca el layout normal): position:fixed inset:0
// cubre todo el dash. Esc para salir. (Office tiene su propio estado en
// useOfficeStore y no usa este hook, pero sí <EmbedActions>.)

import { useState, useCallback, useEffect } from 'react';

const FULLSCREEN_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)',
};
const EMPTY: React.CSSProperties = {};

export function useEmbedFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const toggle = useCallback(() => setFullscreen((f) => !f), []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return { fullscreen, toggle, rootStyle: fullscreen ? FULLSCREEN_STYLE : EMPTY };
}
