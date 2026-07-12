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

// ─── Long-press táctil = seleccionar ────────────────────────────────────────
// En móvil el long-press YA NO abre el menú contextual (el ContextMenu global
// bloquea los contextmenu REALES nacidos de un toque; el menú se abre con el
// botón ⋮ / TileMoreButton). Este hook implementa el gesto que lo sustituye:
// mantener el dedo ~300ms sin moverlo >12px alterna la SELECCIÓN del item
// (haptic best-effort). Solo toggle del item pulsado — sin barrido por rango.
//
// Uso: spread de `handlers` en el tile/fila (solo en móvil) y, en el onClick
// del mismo elemento, salir temprano si `consumeFired()` devuelve true (el
// click que sigue al long-press no debe abrir/seleccionar de nuevo).

import { useEffect, useRef } from 'react';

const PRESS_MS = 300;
const MOVE_SLOP_PX = 12;

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export function useLongPress(onLongPress: () => void, enabled = true): {
  handlers: LongPressHandlers;
  /** true si el click actual es el eco de un long-press ya disparado — suprímelo. */
  consumeFired: () => boolean;
} {
  // Callback en ref → los handlers nunca cierran sobre una versión vieja.
  // (Se actualiza en un effect, no durante el render — regla react-hooks/refs;
  // los eventos táctiles siempre llegan después de los effects del commit.)
  const cbRef = useRef(onLongPress);
  useEffect(() => { cbRef.current = onLongPress; });
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // No dejar el timer vivo tras desmontar (dispararía un toggle fantasma).
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const handlers: LongPressHandlers = {
    onTouchStart: (e) => {
      // Cada toque nuevo resetea el flag: si el navegador no emitió click tras
      // el long-press anterior, el flag no debe tragarse el siguiente tap.
      firedRef.current = false;
      if (!enabled || e.touches.length !== 1) { clear(); return; }
      const t = e.touches[0]!;
      startRef.current = { x: t.clientX, y: t.clientY };
      clear();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        try { navigator.vibrate?.(15); } catch { /* haptic opcional */ }
        cbRef.current();
      }, PRESS_MS);
    },
    onTouchMove: (e) => {
      if (timerRef.current === null || !startRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      // Movimiento = scroll, no long-press.
      if (Math.hypot(t.clientX - startRef.current.x, t.clientY - startRef.current.y) > MOVE_SLOP_PX) {
        clear();
      }
    },
    onTouchEnd: () => clear(),
    onTouchCancel: () => clear(),
  };

  const consumeFired = () => {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  };

  return { handlers, consumeFired };
}
