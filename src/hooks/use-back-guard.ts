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

import { useEffect, useRef } from 'react';

/**
 * Back JERÁRQUICO para sub-vistas que NO viven en la URL.
 *
 * Problema: en el WebView móvil (y en el navegador) el botón "atrás" = history.back
 * (popstate). Pero casi todas las sub-vistas del dash (tarjeta de kanban abierta, editor
 * de nota, modal de evento, lightbox de foto, drawer, composer de correo…) viven en
 * useState/Zustand, no en la URL, así que el back nunca las deshace: hace pop de la RUTA
 * y salta al módulo anterior. El usuario quiere que atrás deshaga el ÚLTIMO paso lógico
 * (cerrar el overlay/volver al nivel anterior) y solo al llegar a la raíz salga del módulo.
 *
 * Este hook generaliza el patrón ya probado en FloatingPanelsLayer: cuando la sub-vista se
 * ABRE (`active` pasa a true) empuja un estado guardia al historial; un back del usuario lo
 * consume y dispara `onBack` (cerrar esa capa). Si la capa se cierra por la UI (no por back),
 * la limpieza consume la entrada guardia con un back auto-inducido para no dejar entradas
 * fantasma. Una PILA central soporta overlays ANIDADOS (tablero → tarjeta → modal): cada back
 * cierra solo la capa de arriba.
 *
 * @param active   true mientras la sub-vista/overlay está abierta.
 * @param onBack   se llama cuando el usuario pulsa atrás estando esta capa en el tope.
 * @param enabled  desactiva el guardia (p.ej. gate a móvil). Default true.
 */

type Guard = { id: number; onBack: () => void; consumed: boolean };

const stack: Guard[] = [];
let selfPops = 0; // nº de back auto-inducidos (limpieza) pendientes de ignorar en el handler
let installed = false;
let nextId = 1;

function ensureListener(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', () => {
    // Back auto-inducido por la limpieza de un guardia → no cerrar ninguna capa.
    if (selfPops > 0) { selfPops -= 1; return; }
    // Back real del usuario → cerrar la capa del tope.
    const g = stack.pop();
    if (g) { g.consumed = true; g.onBack(); }
  });
}

export function useBackGuard(active: boolean, onBack: () => void, enabled = true): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || !active || typeof window === 'undefined') return;
    ensureListener();
    const guard: Guard = { id: nextId++, onBack: () => onBackRef.current(), consumed: false };
    stack.push(guard);
    window.history.pushState({ __backGuard: guard.id }, '');
    return () => {
      const idx = stack.indexOf(guard);
      if (idx !== -1) stack.splice(idx, 1);
      // Cierre por UI (no por back del usuario): si nuestra entrada guardia sigue en el
      // tope del historial, la consumimos (selfPops hace que el handler la ignore) para
      // no dejar una entrada fantasma que obligaría a pulsar atrás dos veces.
      if (!guard.consumed) {
        const st = window.history.state as { __backGuard?: number } | null;
        if (st?.__backGuard === guard.id) {
          selfPops += 1;
          window.history.back();
        }
      }
    };
  }, [active, enabled]);
}
