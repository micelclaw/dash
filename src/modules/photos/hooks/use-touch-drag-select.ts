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

// ─── Selección múltiple táctil por arrastre (estilo Google Photos) ──────────
// Gesto: mantener el dedo ~250ms sobre una foto → SELECCIONA esa foto (haptic)
// y entra en modo selección; sin levantar, ARRASTRAR barre un RANGO contiguo
// entre el ancla y la foto bajo el dedo (elementFromPoint). Mientras se barre,
// el scroll queda bloqueado (touchmove preventDefault).
// El long-press táctil YA NO abre el menú contextual (decisión 2026-07-11:
// ambos en el mismo gesto se pisaban) — ContextMenu lo bloquea globalmente y
// el menú en móvil se abre con el botón ⋮ (TileMoreButton).
// Para escritorio el marquee lo pone react-selecto; este hook solo actúa con
// puntero táctil.
//
// (Buscado código prehecho: selecto/drag-to-select cubren marquee de ratón,
// pero el gesto "long-press + barrido por rango" de las galerías móviles no
// existe empaquetado — este hook implementa ese patrón estándar.)

import { useEffect, useRef } from 'react';

const ARM_DELAY_MS = 250;
const MOVE_SLOP_PX = 12;

interface TouchDragSelectOpts {
  /**
   * Contenedor scrollable que envuelve el grid (los tiles llevan data-photo-id).
   * ELEMENTO (estado), no ref: el timeline monta el contenedor DESPUÉS del
   * primer render (EmptyState mientras carga) y con una ref el efecto no se
   * volvería a suscribir jamás.
   */
  container: HTMLElement | null;
  /** Orden visual actual de las fotos (para el rango ancla→actual). */
  photoIds: string[];
  selectedIds: Set<string>;
  setSelection: (ids: Set<string>) => void;
  enabled: boolean;
}

export function useTouchDragSelect({
  container,
  photoIds,
  selectedIds,
  setSelection,
  enabled,
}: TouchDragSelectOpts) {
  // Refs para no re-suscribir listeners en cada render.
  const idsRef = useRef(photoIds);
  const selectedRef = useRef(selectedIds);
  const setSelectionRef = useRef(setSelection);
  idsRef.current = photoIds;
  selectedRef.current = selectedIds;
  setSelectionRef.current = setSelection;

  useEffect(() => {
    const el = container;
    if (!el || !enabled) return;

    let armTimer: number | null = null;
    let armed = false;
    let dragging = false;
    let anchorId: string | null = null;
    let startX = 0;
    let startY = 0;
    /** Selección al empezar el barrido — el rango se une a ella (no la pisa). */
    let baseSelection: Set<string> = new Set();
    /** Tras un gesto armado, el navegador sintetiza un click sobre el tile que
        haría toggle y DES-seleccionaría el ancla recién seleccionada. Se traga. */
    let suppressClickUntil = 0;

    const clearArm = () => {
      if (armTimer !== null) { window.clearTimeout(armTimer); armTimer = null; }
      armed = false;
    };

    const tileIdAt = (x: number, y: number): string | null => {
      const hit = document.elementFromPoint(x, y);
      return (hit?.closest('[data-photo-id]') as HTMLElement | null)?.dataset.photoId ?? null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { clearArm(); return; }
      const t = e.touches[0]!;
      const id = tileIdAt(t.clientX, t.clientY);
      if (!id) return;
      anchorId = id;
      startX = t.clientX;
      startY = t.clientY;
      dragging = false;
      // En modo selección el gesto arma más rápido (ya hay intención de seleccionar).
      const delay = selectedRef.current.size > 0 ? 150 : ARM_DELAY_MS;
      armTimer = window.setTimeout(() => {
        armed = true;
        // El long-press por sí solo YA selecciona el ancla (estilo Google
        // Photos) — el barrido posterior solo amplía el rango.
        baseSelection = new Set(selectedRef.current);
        baseSelection.add(id);
        setSelectionRef.current(new Set(baseSelection));
        try { navigator.vibrate?.(15); } catch { /* opcional */ }
      }, delay);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || !anchorId) return;
      const moved = Math.hypot(t.clientX - startX, t.clientY - startY) > MOVE_SLOP_PX;

      if (!armed) {
        // Movimiento antes de armar = scroll normal; cancela el gesto.
        if (moved) clearArm();
        return;
      }

      // Armado + movimiento → barrido de selección (bloquea el scroll).
      if (!dragging && moved) dragging = true;
      if (!dragging) return;

      e.preventDefault(); // scroll bloqueado durante el barrido
      const overId = tileIdAt(t.clientX, t.clientY);
      const ids = idsRef.current;
      const a = ids.indexOf(anchorId);
      const b = overId ? ids.indexOf(overId) : -1;
      const next = new Set(baseSelection);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i += 1) next.add(ids[i]!);
      }
      setSelectionRef.current(next);
    };

    const onTouchEnd = () => {
      if (armed || dragging) suppressClickUntil = Date.now() + 400;
      clearArm();
      // dragging se apaga con un pelín de retraso: el contextmenu nativo puede
      // colarse justo al levantar el dedo tras el barrido.
      window.setTimeout(() => { dragging = false; }, 150);
      anchorId = null;
    };

    const onClickCapture = (e: Event) => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickUntil = 0;
      }
    };

    // En móvil el long-press táctil NUNCA debe abrir el menú contextual: se pisa
    // con el gesto de selección (armed ANTES de mover, o dragging) y en Android
    // secuestra el callout nativo sobre la <img>, congelando la app. El menú en
    // móvil se abre solo con el botón ⋮. Este listener sólo se registra con
    // enabled=true (móvil), así que suprimimos TODO contextmenu del contenedor.
    const onContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // touchmove necesita passive:false para poder bloquear el scroll al barrer.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('contextmenu', onContextMenu, true);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      clearArm();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('contextmenu', onContextMenu, true);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [container, enabled]);
}
