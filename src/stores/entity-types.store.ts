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
import { getMyEntityTypes } from '@/services/app-access.service';
import { registerAppEntityTypes } from '@/config/entity-refs';

interface EntityTypesState {
  loaded: boolean;
  refresh: () => Promise<void>;
}

// Carga los tipos de entidad "chipeables"/mencionables de apps L3 (`ui.entities`
// del manifest, p.ej. "workflow" de n8n) y los mergea en ENTITY_REF_MAP +
// MENTION_DOMAINS (config/entity-refs.ts). Boot-only (Shell.tsx), como
// ui-modules.store — fail-soft: si falla, el set base de dominios del core sigue
// funcionando tal cual (no hay estado reactivo que consumir; el merge es directo
// sobre los mapas compartidos, leídos por los consumidores en cada render).
export const useEntityTypesStore = create<EntityTypesState>((set) => ({
  loaded: false,
  refresh: async () => {
    try {
      const entries = await getMyEntityTypes();
      registerAppEntityTypes(entries);
    } catch {
      // fail-soft: sin tipos de apps, el set base del core sigue disponible.
    } finally {
      set({ loaded: true });
    }
  },
}));
