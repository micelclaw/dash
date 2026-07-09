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
 * Escucha los deep-links del wrapper móvil (widgets nativos, share, etc.) y navega
 * a la ruta interna del dash. Usa el puente Capacitor inyectado en runtime
 * (`window.Capacitor.Plugins.App`) SIN importar `@capacitor/*` (el dash se sirve
 * también como PWA/escritorio). No-op fuera del APK.
 *
 * Debe montarse DENTRO del router y de una sesión autenticada → va en el Shell.
 * Cubre arranque en frío (`getLaunchUrl`) y app ya abierta (`appUrlOpen`).
 */
interface AppPluginBridge {
  addListener?: (
    event: 'appUrlOpen',
    cb: (data: { url?: string }) => void,
  ) => Promise<{ remove: () => void }>;
  getLaunchUrl?: () => Promise<{ url?: string } | null>;
}
interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  Plugins?: { App?: AppPluginBridge };
}

export function useDeepLinks(): void {
  const navigate = useNavigate();
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const appPlugin = cap.Plugins?.App;
    if (!appPlugin) return;

    const handle = (url: string | undefined) => {
      if (!url || url === lastHandled.current) return;
      const route = parseDeepLink(url);
      if (!route) return;
      lastHandled.current = url;
      navigate(route);
    };

    let cancelled = false;
    let remove: (() => void) | undefined;

    // Arranque en frío: la app se abrió por un deep-link (widget con la app cerrada).
    void appPlugin.getLaunchUrl?.().then((res) => {
      if (!cancelled) handle(res?.url);
    }).catch(() => {});

    // App ya abierta: el deep-link llega en caliente.
    void appPlugin.addListener?.('appUrlOpen', (data) => handle(data?.url))
      .then((h) => {
        if (cancelled) h.remove();
        else remove = () => h.remove();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [navigate]);
}
