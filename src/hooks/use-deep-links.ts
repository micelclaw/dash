/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { parseDeepLink } from '@/lib/deep-link';

/**
 * Recibe deep-links del wrapper móvil (widgets nativos) y navega a la ruta interna.
 *
 * IMPORTANTE: el dash se sirve desde un origen REMOTO (http(s)://…) al que Capacitor
 * NO inyecta su puente (`window.Capacitor` es undefined ahí, aunque allowNavigation
 * permita la navegación). Por eso NO usamos `@capacitor/app` appUrlOpen: en su lugar,
 * MainActivity (nativo) parsea el intent `micelclaw://open?route=…` y llama por
 * `evaluateJavascript` a `window.__clawDeepLink(<uri>)`, que exponemos aquí. El nativo
 * reintenta hasta que este handler existe (cubre el arranque en frío). No-op en web/PWA
 * (nadie llama al global).
 */
export function useDeepLinks(): void {
  const navigate = useNavigate();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    const go = (raw: string) => {
      const route = parseDeepLink(raw);
      if (!route || route === lastRef.current) return;
      lastRef.current = route;
      navigate(route);
    };
    const w = window as unknown as {
      __clawDeepLink?: (raw: string) => void;
      __clawPendingDeepLink?: string | null;
    };
    w.__clawDeepLink = go;
    // Por si el nativo dejó un deep-link pendiente antes de montar el handler.
    if (w.__clawPendingDeepLink) {
      const pending = w.__clawPendingDeepLink;
      w.__clawPendingDeepLink = null;
      go(pending);
    }
    return () => {
      if (w.__clawDeepLink === go) delete w.__clawDeepLink;
    };
  }, [navigate]);
}
