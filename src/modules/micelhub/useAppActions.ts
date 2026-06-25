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

import type { MouseEvent } from 'react';
import { toast } from 'sonner';
import { scanApp, exportApp, updateAppStatus } from '@/services/apps.service';
import { useAppsStore } from '@/stores/apps.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import type { InstalledApp } from '@/types/apps';

/**
 * Acciones de una app instalada (scan/export/enable-disable), compartidas por la tarjeta
 * (AppCard) y la fila de lista (AppListRow) para no divergir. Cada handler hace
 * stopPropagation (los botones viven dentro de un contenedor clicable que abre el detalle).
 * Solo válidas para installed_apps reales (registry/adapted) — van por /apps/:name.
 */
export function useAppActions(app: InstalledApp, onRefresh: () => void) {
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);

  const handleScan = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await scanApp(app.app_name);
      if (result.passed) {
        toast.success(`Scan passed — ${result.warnings.length} warning(s)`);
      } else {
        toast.error(`Scan failed — ${result.errors.length} error(s)`);
      }
    } catch {
      toast.error('Scan failed');
    }
  };

  const handleExport = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await exportApp(app.app_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.app_name}-${app.version}.claw`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleToggleStatus = async (e: MouseEvent) => {
    e.stopPropagation();
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAppStatus(app.app_name, newStatus);
      // Solo las skills L1 (OpenClaw) exigen reload del Gateway. Las L2/L3 con backend nativo
      // (p.ej. n8n, UI-only) NO requieren reiniciar Core — refrescar los módulos dinámicos
      // refleja el enable/disable en el sidebar al instante (alineado con AppDetail).
      if (app.app_level === 1) {
        setRestartRequired('openclaw', `${app.app_name} was ${newStatus}`);
      }
      onRefresh();
      void useUiModulesStore.getState().refresh();
      toast.success(`App ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return { handleScan, handleExport, handleToggleStatus };
}
