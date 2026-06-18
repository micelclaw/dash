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

import { create } from 'zustand';
import { getMyAppAccess } from '@/services/app-access.service';

interface AppAccessState {
  /** Keys de apps que el usuario actual puede ver (effective). */
  allowed: Set<string>;
  loaded: boolean;
  refresh: () => Promise<void>;
  isAllowed: (key: string) => boolean;
}

// Gating per-usuario de módulos (rediseño NAS, Fase 1). El backend (/me/app-access)
// devuelve el set EFECTIVO (defaults + opt_in concedidas + admin si admin/owner).
export const useAppAccessStore = create<AppAccessState>((set, get) => ({
  allowed: new Set<string>(),
  loaded: false,
  refresh: async () => {
    try {
      const allowed = await getMyAppAccess();
      set({ allowed: new Set(allowed), loaded: true });
    } catch {
      // fail-open: si falla, dejamos loaded=false → el Sidebar muestra opt_in
      // (no bloqueamos al usuario por un error transitorio).
    }
  },
  isAllowed: (key) => get().allowed.has(key),
}));
