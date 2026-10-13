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

import { Search, RefreshCw, Plus, Zap, Archive, Loader2, Columns3, Rows3 } from 'lucide-react';
import { PRIORITY_LABEL, PRIORITY_ORDER } from './lanes';
import type { WorkboardPriority } from './types';
import type { ManagedAgent } from '../types';

export type ViewPreset = 'all' | 'unassigned' | 'ready' | 'running' | 'blocked' | 'review';
export type ViewMode = 'phases' | 'lanes';

export interface WorkboardFilters {
  search: string;
  priority: WorkboardPriority | 'all';
  agent: string; // '' = todos
  preset: ViewPreset;
  showArchived: boolean;
  quick: string | null; // clave de pill activa (filtro rápido)
}

export const DEFAULT_FILTERS: WorkboardFilters = {
  search: '', priority: 'all', agent: '', preset: 'all', showArchived: false, quick: null,
};

export const PRESET_LABEL: Record<ViewPreset, string> = {
  all: 'Todas las tarjetas', unassigned: 'Sin asignar', ready: 'Listas',
  running: 'En ejecución', blocked: 'Bloqueadas', review: 'En revisión',
};

interface Props {
  filters: WorkboardFilters;
  onFilters: (f: WorkboardFilters) => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  hideEmpty: boolean;
  onHideEmpty: (v: boolean) => void;
  agents: ManagedAgent[];
  autoRefresh: boolean;
  onAutoRefresh: (v: boolean) => void;
  onRefresh: () => void;
  onDispatch: () => void;
  dispatching: boolean;
  onNewCard: () => void;
}

const ctrl = {
  fontSize: '0.75rem', padding: '6px 9px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
} as const;

const iconBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
  cursor: 'pointer', fontSize: '0.75rem',
} as const;

export function WorkboardToolbar(props: Props) {
  const { filters, onFilters, viewMode, onViewMode, hideEmpty, onHideEmpty, agents, autoRefresh, onAutoRefresh, onRefresh, onDispatch, dispatching, onNewCard } = props;
  const set = (patch: Partial<WorkboardFilters>) => onFilters({ ...filters, ...patch });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {/* Búsqueda */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Search size={13} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar tarjetas…"
          style={{ ...ctrl, paddingLeft: 26, width: 180 }}
        />
      </div>

      {/* Vista (preset) */}
      <select value={filters.preset} onChange={(e) => set({ preset: e.target.value as ViewPreset })} style={ctrl} title="Vista">
        {(Object.keys(PRESET_LABEL) as ViewPreset[]).map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}
      </select>

      {/* Prioridad */}
      <select value={filters.priority} onChange={(e) => set({ priority: e.target.value as WorkboardPriority | 'all' })} style={ctrl} title="Prioridad">
        <option value="all">Todas las prioridades</option>
        {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p].charAt(0).toUpperCase() + PRIORITY_LABEL[p].slice(1)}</option>)}
      </select>

      {/* Agente */}
      <select value={filters.agent} onChange={(e) => set({ agent: e.target.value })} style={ctrl} title="Agente">
        <option value="">Todos los agentes</option>
        {agents.map((a) => <option key={a.id} value={a.name}>{a.display_name}</option>)}
      </select>

      {/* Archivadas */}
      <button
        onClick={() => set({ showArchived: !filters.showArchived })}
        title="Mostrar archivadas"
        style={{ ...iconBtn, ...(filters.showArchived ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}
      >
        <Archive size={13} /> Archivadas
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {/* Modo de vista: Fases / Carriles */}
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => onViewMode('phases')} title="Vista por fases (9 columnas)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', background: viewMode === 'phases' ? 'var(--bg-subtle, rgba(127,127,127,0.14))' : 'transparent', color: viewMode === 'phases' ? 'var(--text)' : 'var(--text-dim)' }}>
            <Columns3 size={13} /> Fases
          </button>
          <button onClick={() => onViewMode('lanes')} title="Vista por carriles (5 columnas)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.75rem', background: viewMode === 'lanes' ? 'var(--bg-subtle, rgba(127,127,127,0.14))' : 'transparent', color: viewMode === 'lanes' ? 'var(--text)' : 'var(--text-dim)' }}>
            <Rows3 size={13} /> Carriles
          </button>
        </div>

        {/* Ocultar vacías */}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={hideEmpty} onChange={(e) => onHideEmpty(e.target.checked)} /> Ocultar vacías
        </label>

        {/* Auto-refresh */}
        <button onClick={() => onAutoRefresh(!autoRefresh)} title="Actualización automática (8s)"
          style={{ ...iconBtn, ...(autoRefresh ? { borderColor: 'var(--green, #10b981)', color: 'var(--green, #10b981)' } : {}) }}>
          Auto {autoRefresh ? 'ON' : 'OFF'}
        </button>

        {/* Refrescar */}
        <button onClick={onRefresh} title="Refrescar" style={iconBtn}><RefreshCw size={13} /></button>

        {/* Avisar al despachador */}
        <button onClick={onDispatch} disabled={dispatching} title="Pone en ejecución y a trabajar las tareas asignadas, y suelta las reclamaciones caducadas"
          style={{ ...iconBtn, opacity: dispatching ? 0.6 : 1 }}>
          {dispatching ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Avisar al despachador
        </button>

        {/* Nueva tarea */}
        <button onClick={onNewCard}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--amber)', color: '#1a1205', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Nueva tarea
        </button>
      </div>
    </div>
  );
}
