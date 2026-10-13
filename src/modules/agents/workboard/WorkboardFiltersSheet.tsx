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

import { Zap, RefreshCw, Loader2, RotateCcw, Columns3, Rows3 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DialogTitle } from '@/components/ui/dialog';
import { WorkboardStatsPills } from './WorkboardStatsPills';
import { PRESET_LABEL, DEFAULT_FILTERS, type WorkboardFilters, type ViewPreset, type ViewMode } from './WorkboardToolbar';
import { PRIORITY_LABEL, PRIORITY_ORDER } from './lanes';
import type { WorkboardPriority, WorkboardCard, WorkboardDiagnostic } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
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
  cards: WorkboardCard[];
  diagnostics: WorkboardDiagnostic[];
}

const label = { fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 } as const;
const field = { width: '100%', minHeight: 42, fontSize: '0.875rem', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' } as const;

function ToggleRow({ text, on, onToggle, accent }: { text: string; on: boolean; onToggle: () => void; accent?: string }) {
  return (
    <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.875rem', cursor: 'pointer' }}>
      <span style={{ flex: 1, textAlign: 'left' }}>{text}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: on ? (accent || 'var(--green, #10b981)') : 'var(--text-muted)' }}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export function WorkboardFiltersSheet(props: Props) {
  const { open, onClose, filters, onFilters, viewMode, onViewMode, hideEmpty, onHideEmpty, agents, autoRefresh, onAutoRefresh, onRefresh, onDispatch, dispatching, cards, diagnostics } = props;
  const set = (patch: Partial<WorkboardFilters>) => onFilters({ ...filters, ...patch });

  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 42,
    border: 'none', cursor: 'pointer', fontSize: '0.8125rem',
    background: active ? 'var(--bg-subtle, rgba(127,127,127,0.16))' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)', fontWeight: active ? 600 : 400,
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" style={{ maxHeight: '88dvh', overflowY: 'auto', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }} data-testid="wb-filters-sheet">
        <DialogTitle style={{ fontSize: '0.95rem', fontWeight: 600 }}>Filtros y vista</DialogTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {/* Vista */}
          <div>
            <div style={label}>Vista</div>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => onViewMode('phases')} style={segBtn(viewMode === 'phases')}><Columns3 size={14} /> Fases</button>
              <button onClick={() => onViewMode('lanes')} style={{ ...segBtn(viewMode === 'lanes'), borderLeft: '1px solid var(--border)' }}><Rows3 size={14} /> Carriles</button>
            </div>
          </div>

          {/* Estado (pills como filtro rápido) */}
          <div>
            <div style={label}>Estado</div>
            <WorkboardStatsPills cards={cards} diagnostics={diagnostics} active={filters.quick} onToggle={(q) => set({ quick: q })} />
          </div>

          {/* Filtros */}
          <div>
            <div style={label}>Vista rápida</div>
            <select value={filters.preset} onChange={(e) => set({ preset: e.target.value as ViewPreset })} style={field}>
              {(Object.keys(PRESET_LABEL) as ViewPreset[]).map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Prioridad</div>
            <select value={filters.priority} onChange={(e) => set({ priority: e.target.value as WorkboardPriority | 'all' })} style={field}>
              <option value="all">Todas las prioridades</option>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p].charAt(0).toUpperCase() + PRIORITY_LABEL[p].slice(1)}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Agente</div>
            <select value={filters.agent} onChange={(e) => set({ agent: e.target.value })} style={field}>
              <option value="">Todos los agentes</option>
              {agents.map((a) => <option key={a.id} value={a.name}>{a.display_name}</option>)}
            </select>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ToggleRow text="Mostrar archivadas" on={filters.showArchived} onToggle={() => set({ showArchived: !filters.showArchived })} accent="var(--amber)" />
            <ToggleRow text="Ocultar columnas vacías" on={hideEmpty} onToggle={() => onHideEmpty(!hideEmpty)} accent="var(--amber)" />
            <ToggleRow text="Actualización automática" on={autoRefresh} onToggle={() => onAutoRefresh(!autoRefresh)} />
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDispatch} disabled={dispatching} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'pointer', opacity: dispatching ? 0.6 : 1 }}>
              {dispatching ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Despachador
            </button>
            <button onClick={onRefresh} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <RefreshCw size={14} /> Refrescar
            </button>
          </div>

          <button onClick={() => onFilters({ ...DEFAULT_FILTERS })} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <RotateCcw size={13} /> Limpiar filtros
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
