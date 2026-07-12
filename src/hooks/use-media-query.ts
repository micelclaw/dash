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

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/**
 * Teléfono en CUALQUIER orientación. `useIsMobile` es solo por ancho, así que un
 * teléfono en horizontal (ancho > 767) se toma por escritorio — bug que sacaba el
 * Sidebar de módulos y la BottomBar de escritorio en landscape. El segundo término
 * `(max-height: 500px)` captura el landscape de teléfono (alto corto) sin afectar a
 * tablets (su alto en landscape ~768). Úsalo para decidir "app móvil" en el shell.
 */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px), (max-height: 500px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1279px)');
}

/**
 * `true` mientras el teclado virtual de Android está desplegado. Se detecta con
 * `window.visualViewport` (el plugin `@capacitor/keyboard` NO está disponible en
 * el origen remoto del dash — `window.Capacitor` es undefined ahí).
 *
 * Robusto ante los dos modos de Android: `adjustResize`/native (el WebView encoge
 * → `visualViewport.height` cae) y `adjustPan` (el viewport visual encoge sobre el
 * layout). Comparamos contra la mayor altura vista en la orientación ACTUAL, y
 * reiniciamos esa línea base al cambiar el ancho (rotación) para no confundir un
 * giro con el teclado. Umbral 150px: los teclados ocupan ≳250px; las toolbars/URL
 * bar <100. En escritorio no hay teclado virtual → `visualViewport` no encoge →
 * siempre `false`.
 */
export function useKeyboardOpen(): boolean {
  // Gate a teléfono: en escritorio no hay teclado virtual y redimensionar la
  // ventana (bajar la altura con el mismo ancho) sería un falso positivo.
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isPhone) { setOpen(false); return; }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return; // WebViews sin visualViewport → nunca oculta (default seguro)

    let baseH = vv.height; // altura "sin teclado" (la mayor vista en esta orientación)
    let baseW = vv.width;
    const onResize = () => {
      // Rotación / cambio de ancho → reiniciar la línea base (evita falso positivo).
      if (Math.abs(vv.width - baseW) > 1) {
        baseW = vv.width;
        baseH = vv.height;
        setOpen(false);
        return;
      }
      baseH = Math.max(baseH, vv.height);
      setOpen(baseH - vv.height > 150);
    };

    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, [isPhone]);

  return isPhone && open;
}
