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
import { getMyUiModules, type UiModule } from '@/services/app-access.service';

interface UiModulesState {
  /** Módulos dinámicos (apps L3 instaladas+activas+concedidas) del usuario actual. */
  modules: UiModule[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

// Módulos dinámicos del dash (apps L3 servidas por Core como iframe). El backend
// (/me/ui-modules) ya los filtra por instalada+activa+cargada+concedida → el dash
// los pinta tal cual (no re-evalúa el gating). Sidebar + router los consumen.
export const useUiModulesStore = create<UiModulesState>((set) => ({
  modules: [],
  loaded: false,
  refresh: async () => {
    try {
      const modules = await getMyUiModules();
      set({ modules, loaded: true });
    } catch {
      // fail-soft: si falla, no añadimos módulos dinámicos (los estáticos siguen).
      set({ loaded: true });
    }
  },
}));
