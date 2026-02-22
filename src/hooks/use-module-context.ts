import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { MODULES } from '@/config/modules';

interface ModuleContext {
  moduleId: string | null;
  modulePath: string | null;
  activeItem: { id: string; type: string; title: string } | null;
}

export function useModuleContext(): ModuleContext {
  const location = useLocation();

  return useMemo(() => {
    const path = location.pathname;
    const mod = MODULES.find((m) => m.path && path.startsWith(m.path));

    return {
      moduleId: mod?.id ?? null,
      modulePath: mod?.path ?? null,
      activeItem: null, // Placeholder — modules will inject active item via context in future phases
    };
  }, [location.pathname]);
}
