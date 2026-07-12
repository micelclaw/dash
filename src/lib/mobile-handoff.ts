/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

/**
 * Puente de sesión app móvil → dash.
 *
 * El envoltorio Capacitor (micelclaw-companions/apps/mobile) hace el onboarding
 * de acceso en SU PROPIO origen (capacitor://localhost) y luego navega el WebView
 * al dash. Como el localStorage es por-origen, el onboarding NO puede escribir el
 * store de auth del dash directamente → entrega la sesión ya autenticada en el
 * hash de la URL (`#mmauth=<base64url(JSON)>`). Aquí la consumimos ANTES de que
 * monte React/AuthGate, rellenamos el store `claw-auth` y limpiamos el hash al
 * instante (el token no queda en la barra ni en el historial).
 *
 * No-op en la web/PWA normal (sin hash) → cero efecto fuera del envoltorio.
 */
import { useAuthStore } from '@/stores/auth.store';
import type { User, AuthTokens } from '@/types/auth';

interface HandoffPayload {
  method?: string;
  accessToken?: string;
  refreshToken?: string;
  refreshTokenId?: string;
  user?: User;
  remember?: boolean;
}

export function consumeMobileHandoff(): void {
  const raw = window.location.hash;
  const m = /[#&]mmauth=([^&]+)/.exec(raw);
  if (!m) return;

  try {
    const payload = JSON.parse(b64urlDecode(m[1])) as HandoffPayload;
    if (payload?.accessToken && payload?.user) {
      // Propaga la elección "recordar" del onboarding a la persistencia del dash
      // (claw-remember): true → localStorage (30d), false → sessionStorage. Debe
      // fijarse ANTES de setAuth (el storage del auth store lo lee al persistir).
      try { localStorage.setItem('claw-remember', payload.remember === false ? '0' : '1'); } catch { /* no-op */ }
      const tokens: AuthTokens = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken ?? '',
        refreshTokenId: payload.refreshTokenId,
      };
      useAuthStore.getState().setAuth(payload.user, tokens);
    }
  } catch {
    /* handoff malformado → se ignora y cae al login normal */
  } finally {
    // Limpia el hash SIEMPRE (aunque falle) para no dejar el token en la URL.
    const clean = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', clean || '/');
  }
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}
