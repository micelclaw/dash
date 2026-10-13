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

import { LANES, STATUS_COLUMNS } from './lanes';
import { PILLS, type DiagIndex } from './pills';
import type { WorkboardCard, WorkboardStatus } from './types';
import type { ViewMode, WorkboardFilters } from './WorkboardToolbar';

/** Columna del board (una fase, o un carril que agrupa varias fases). */
export interface Column {
  key: string;
  label: string;
  accent: string;
  statuses: WorkboardStatus[];
  moveTo: WorkboardStatus;
}

/** Modelo de columnas según la vista: 9 fases o 5 carriles. Compartido por board escritorio/móvil. */
export function buildColumns(viewMode: ViewMode): Column[] {
  return viewMode === 'phases'
    ? STATUS_COLUMNS.map((c) => ({ key: c.status, label: c.label, accent: c.accent, statuses: [c.status], moveTo: c.status }))
    : LANES.map((l) => ({ key: l.key, label: l.label, accent: l.accent, statuses: l.statuses, moveTo: l.moveTo }));
}

/** ¿Pasa la tarjeta los filtros de la toolbar (búsqueda/preset/prioridad/agente/archivadas/pill)? */
export function passesFilters(c: WorkboardCard, f: WorkboardFilters, diag: DiagIndex): boolean {
  const archived = Boolean(c.metadata?.archived_at);
  if (!f.showArchived && archived) return false;
  if (f.search.trim()) {
    const q = f.search.toLowerCase();
    const hay = [c.title, c.notes ?? '', ...(c.labels ?? [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.priority !== 'all' && c.priority !== f.priority) return false;
  if (f.agent && c.agent_id !== f.agent) return false;
  if (f.preset === 'unassigned' && c.agent_id) return false;
  if (f.preset === 'ready' && c.status !== 'ready') return false;
  if (f.preset === 'running' && c.status !== 'running') return false;
  if (f.preset === 'blocked' && c.status !== 'blocked') return false;
  if (f.preset === 'review' && c.status !== 'review') return false;
  if (f.quick) {
    const pill = PILLS.find((p) => p.key === f.quick);
    if (pill && !pill.match(c, diag)) return false;
  }
  return true;
}

/** ¿Hay algún filtro activo (para pintar en ámbar el botón "Filtros" del móvil)? */
export function hasActiveFilters(f: WorkboardFilters): boolean {
  return Boolean(f.search.trim()) || f.priority !== 'all' || Boolean(f.agent) || f.preset !== 'all' || f.showArchived || Boolean(f.quick);
}
