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

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { MODULES } from '@/config/modules';
import { DEFAULT_APP_KEYS } from '@/config/app-catalog';
import { useAppAccessStore } from '@/stores/app-access.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsPhone } from '@/hooks/use-media-query';

// Guard de un único punto (rediseño NAS, Fase 1): si el usuario navega por URL
// directa a un módulo que NO tiene permitido (opt_in no concedida, o adminOnly
// sin ser admin), redirige a /chat. La visibilidad del Sidebar ya lo oculta;
// esto cubre el acceso por URL. Fail-open hasta que carga /me/app-access.
export function AppAccessGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const allowed = useAppAccessStore((s) => s.allowed);
  const loaded = useAppAccessStore((s) => s.loaded);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin' || role === 'owner';
  const isPhone = useIsPhone();

  const path = location.pathname;
  const mod = MODULES
    .filter((m) => m.path && (path === m.path || path.startsWith(m.path + '/')))
    .sort((a, b) => b.path!.length - a.path!.length)[0];
  // Módulos desktop-only (p.ej. Studio): en teléfono se redirigen aunque se
  // navegue por URL directa. No depende de /me/app-access (evalúa siempre).
  if (mod?.desktopOnly && isPhone) return <Navigate to="/chat" replace />;

  if (loaded && mod) {
    const denied = mod.adminOnly
      ? !isAdmin
      : !DEFAULT_APP_KEYS.includes(mod.id) && !allowed.has(mod.id);
    if (denied) return <Navigate to="/chat" replace />;
  }
  return <>{children}</>;
}
