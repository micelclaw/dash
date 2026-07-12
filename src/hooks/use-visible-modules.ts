/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

// Lista de módulos VISIBLES para el usuario (estáticos con gating admin/app-access
// + dinámicos de apps instaladas), agrupada. Misma regla de gating que el Sidebar
// (`components/shell/Sidebar.tsx`) — extraída aquí para reutilizarla en el grid
// "Más" del shell móvil sin duplicar la lógica.
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useAppAccessStore } from '@/stores/app-access.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { DEFAULT_APP_KEYS } from '@/config/app-catalog';
import { MODULES } from '@/config/modules';
import { lucideLookup } from '@/config/lucide-lookup';
import { useIsPhone } from '@/hooks/use-media-query';
import type { ModuleConfig } from '@/types/modules';

export interface ModuleGroup { name: string | null; modules: ModuleConfig[] }

export function useVisibleModules(): { ungrouped: ModuleConfig[]; groups: ModuleGroup[]; all: ModuleConfig[] } {
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const isPhone = useIsPhone();
  const appAllowed = useAppAccessStore((s) => s.allowed);
  const appLoaded = useAppAccessStore((s) => s.loaded);
  const dynamicModules = useUiModulesStore((s) => s.modules);

  return useMemo(() => {
    const staticVisible = MODULES.filter((m) => {
      if (m.desktopOnly && isPhone) return false;
      if (m.adminOnly) return isAdmin;
      if (DEFAULT_APP_KEYS.includes(m.id)) return true;
      return !appLoaded || appAllowed.has(m.id);
    });

    const dynConfigs: ModuleConfig[] = dynamicModules.map((d) => ({
      id: d.id, label: d.label, icon: lucideLookup(d.icon),
      color: d.color ?? 'var(--accent)', path: `/app/${d.app_name}`, group: d.group,
    }));
    const merged = [...staticVisible];
    for (const d of dynamicModules) {
      const cfg = dynConfigs.find((c) => c.id === d.id);
      if (!cfg || merged.some((m) => m.id === cfg.id)) continue;
      const idx = d.order_after ? merged.findIndex((m) => m.id === d.order_after) : -1;
      if (idx >= 0) merged.splice(idx + 1, 0, cfg); else merged.push(cfg);
    }

    const ungrouped = merged.filter((m) => !m.group);
    const grouped = merged.filter((m) => m.group);
    const groupNames = [...new Set(grouped.map((m) => m.group!))];
    const groups: ModuleGroup[] = groupNames.map((name) => ({ name, modules: grouped.filter((m) => m.group === name) }));
    return { ungrouped, groups, all: merged };
  }, [isAdmin, isPhone, appLoaded, appAllowed, dynamicModules]);
}
