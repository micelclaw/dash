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

// ─── useEscapeToClose ────────────────────────────────────────────────
// Cierra un overlay/panel/modal al pulsar Escape. Primitiva compartida para
// no repetir el mismo keydown en cada componente (patrón que faltaba en
// office, vpn, inventory, projects…). Por defecto IGNORA el Escape cuando el
// foco está en un campo de texto (input/textarea/select/contenteditable), de
// modo que no se roba el Escape a un formulario inline ni se cierra el panel
// a media edición. Pásale `ignoreWhenTyping: false` para modales sin campos.

import { useEffect } from 'react';

interface UseEscapeToCloseOptions {
  /** Si es false, no se registra el listener. Por defecto true. */
  enabled?: boolean;
  /**
   * Si es true (por defecto), Escape se ignora mientras el foco está en un
   * campo de texto, para no pisar handlers locales ni cerrar a media edición.
   */
  ignoreWhenTyping?: boolean;
}

export function useEscapeToClose(onClose: () => void, options: UseEscapeToCloseOptions = {}): void {
  const { enabled = true, ignoreWhenTyping = true } = options;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (ignoreWhenTyping) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, enabled, ignoreWhenTyping]);
}
