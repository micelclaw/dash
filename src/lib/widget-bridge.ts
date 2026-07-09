/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useAuthStore } from '@/stores/auth.store';

/**
 * Mantiene fresca la credencial que leen los widgets nativos de Android.
 *
 * El onboarding del wrapper siembra `SharedPreferences('CapacitorStorage')` clave
 * `mm-widget-auth` con {baseUrl, authMethod, deviceToken, refreshToken}. Pero tras
 * navegar al dash, es EL DASH quien rota el refresh token (api.ts). Si no
 * reescribiéramos aquí, la copia del widget quedaría obsoleta y los widgets de datos
 * con login morirían a las horas. Con emparejamiento (deviceToken) no cambia, pero
 * preservamos el valor sembrado.
 *
 * Usa el puente Capacitor inyectado en runtime (window.Capacitor.Plugins.Preferences)
 * — sin importar @capacitor/preferences (el dash no es proyecto Capacitor). No-op en web.
 */
interface PreferencesBridge {
  get?: (o: { key: string }) => Promise<{ value: string | null }>;
  set?: (o: { key: string; value: string }) => Promise<void>;
}
interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  Plugins?: { Preferences?: PreferencesBridge };
}

export function configureWidgetBridge(): void {
  const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const prefs = cap.Plugins?.Preferences;
  if (!prefs?.get || !prefs?.set) return;

  let last = '';
  const sync = async () => {
    const tokens = useAuthStore.getState().tokens;
    let blob: Record<string, unknown> = {};
    try {
      const r = await prefs.get!({ key: 'mm-widget-auth' });
      if (r?.value) blob = JSON.parse(r.value) as Record<string, unknown>;
    } catch { /* sin semilla todavía */ }

    const next = {
      ...blob,
      baseUrl: window.location.origin,
      // El refresh token rota en el dash → lo mantenemos al día (login). Emparejamiento
      // no lo usa: preserva el deviceToken/authMethod sembrados por el onboarding.
      refreshToken: tokens?.refreshToken || (blob.refreshToken ?? null),
    };
    const s = JSON.stringify(next);
    if (s === last) return;
    last = s;
    try { await prefs.set!({ key: 'mm-widget-auth', value: s }); } catch { /* no-op */ }
  };

  void sync();
  useAuthStore.subscribe(() => { void sync(); });
}
