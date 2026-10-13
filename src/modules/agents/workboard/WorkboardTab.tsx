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

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Search, SlidersHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useWorkboard } from './use-workboard';
import { WorkboardBoard } from './WorkboardBoard';
import { WorkboardMobileBoard } from './WorkboardMobileBoard';
import { WorkboardToolbar, DEFAULT_FILTERS, type WorkboardFilters, type ViewMode } from './WorkboardToolbar';
import { WorkboardFiltersSheet } from './WorkboardFiltersSheet';
import { WorkboardStatsPills } from './WorkboardStatsPills';
import { WorkboardBootstrapCard } from './WorkboardBootstrapCard';
import { DiagnosticsBanner } from './DiagnosticsBanner';
import { NewCardModal } from './NewCardModal';
import { hasActiveFilters } from './filtering';
import { PILLS, countPill, buildDiagIndex } from './pills';
import { workboardApi } from './workboard.service';
import type { ManagedAgent } from '../types';

interface Props {
  agents: ManagedAgent[];
}

const readLS = (k: string, fallback: string) => {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
};

export function WorkboardTab({ agents }: Props) {
  const isMobile = useIsMobile();
  const { status, statusError, cards, diagnostics, loading, autoRefresh, setAutoRefresh, refreshStatus, loadCards } = useWorkboard();
  const [showNew, setShowNew] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WorkboardFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (readLS('workboard-view', 'phases') as ViewMode));
  const [hideEmpty, setHideEmpty] = useState<boolean>(() => readLS('workboard-hide-empty', '0') === '1');

  const changeViewMode = (m: ViewMode) => { setViewMode(m); try { localStorage.setItem('workboard-view', m); } catch { /* ignore */ } };
  const changeHideEmpty = (v: boolean) => { setHideEmpty(v); try { localStorage.setItem('workboard-hide-empty', v ? '1' : '0'); } catch { /* ignore */ } };

  // Punto de atención en el botón "Filtros" (móvil): alguna pill de problema con cuenta>0.
  const attention = useMemo(() => {
    const idx = buildDiagIndex(diagnostics);
    return PILLS.filter((p) => p.key !== 'running').some((p) => countPill(p, cards, idx) > 0);
  }, [cards, diagnostics]);

  const dispatch = async () => {
    setDispatching(true);
    try {
      const res = await workboardApi.dispatch();
      // Toast honesto: refleja lo que realmente pasó (cuántas tareas se pusieron a trabajar).
      if (res.dispatched > 0) {
        toast.success(
          `${res.dispatched} tarea${res.dispatched !== 1 ? 's' : ''} puesta${res.dispatched !== 1 ? 's' : ''} a trabajar` +
            (res.promoted ? ` · ${res.promoted} promovida${res.promoted !== 1 ? 's' : ''}` : ''),
          { action: { label: 'Ver', onClick: () => navigate(res.conversation_ids?.[0] ? `/chat?conversation=${res.conversation_ids[0]}` : '/chat') } },
        );
      } else if (res.promoted > 0) {
        toast.success(`${res.promoted} tarea${res.promoted !== 1 ? 's' : ''} promovida${res.promoted !== 1 ? 's' : ''}. Ninguna asignada lista para trabajar.`);
      } else {
        toast.info('Nada que despachar. Asigna un agente a las tareas y muévelas a «Por reclamar».');
      }
      await loadCards();
    } catch { toast.error('No se pudo avisar al despachador'); }
    finally { setDispatching(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 48, color: 'var(--text-dim)' }}>
        <Loader2 size={16} className="animate-spin" /> Cargando Workboard…
      </div>
    );
  }

  // No activado, o activado pero el Gateway aún no cargó el plugin → bootstrap.
  if (statusError || !status?.enabled || !status.reachable) {
    return (
      <WorkboardBootstrapCard
        enabledPendingReload={Boolean(status?.enabled && !status.reachable)}
        availabilityError={statusError ?? status?.error?.message ?? null}
        onEnabled={refreshStatus}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>Workboard</h3>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {isMobile ? 'coordinación de agentes' : 'coordinación de agentes · cola de trabajo y traspaso de sesión'}
        </span>
      </div>

      {isMobile ? (
        <>
          {/* Fila compacta: buscar + filtros + nueva */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar tarjetas…"
                style={{ width: '100%', minHeight: 42, fontSize: '0.875rem', padding: '10px 12px 10px 30px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
            </div>
            <button
              onClick={() => setShowFilters(true)}
              title="Filtros y vista"
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: 10, border: `1px solid ${hasActiveFilters(filters) ? 'var(--amber)' : 'var(--border)'}`, background: 'transparent', color: hasActiveFilters(filters) ? 'var(--amber)' : 'var(--text-dim)', cursor: 'pointer' }}
            >
              <SlidersHorizontal size={17} />
              {attention && <span style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)' }} />}
            </button>
            <button
              onClick={() => setShowNew(true)}
              title="Nueva tarea"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--amber)', color: '#1a1205', cursor: 'pointer' }}
            >
              <Plus size={18} />
            </button>
          </div>

          {cards.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle, rgba(127,127,127,0.06))', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              Sin tareas todavía. Crea una con <strong>Nueva tarea</strong>, o un council las generará al cerrar.
            </div>
          )}

          <WorkboardMobileBoard
            cards={cards} agents={agents}
            viewMode={viewMode} hideEmpty={hideEmpty}
            filters={filters} diagnostics={diagnostics}
            onChanged={loadCards}
          />

          <WorkboardFiltersSheet
            open={showFilters} onClose={() => setShowFilters(false)}
            filters={filters} onFilters={setFilters}
            viewMode={viewMode} onViewMode={changeViewMode}
            hideEmpty={hideEmpty} onHideEmpty={changeHideEmpty}
            agents={agents}
            autoRefresh={autoRefresh} onAutoRefresh={setAutoRefresh}
            onRefresh={loadCards}
            onDispatch={dispatch} dispatching={dispatching}
            cards={cards} diagnostics={diagnostics}
          />
        </>
      ) : (
        <>
          <WorkboardToolbar
            filters={filters} onFilters={setFilters}
            viewMode={viewMode} onViewMode={changeViewMode}
            hideEmpty={hideEmpty} onHideEmpty={changeHideEmpty}
            agents={agents}
            autoRefresh={autoRefresh} onAutoRefresh={setAutoRefresh}
            onRefresh={loadCards}
            onDispatch={dispatch} dispatching={dispatching}
            onNewCard={() => setShowNew(true)}
          />

          <WorkboardStatsPills cards={cards} diagnostics={diagnostics} active={filters.quick} onToggle={(q) => setFilters({ ...filters, quick: q })} />

          <DiagnosticsBanner diagnostics={diagnostics} />

          {cards.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle, rgba(127,127,127,0.06))', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              Sin tareas todavía. Crea una con <strong>Nueva tarea</strong>, o un council las generará al cerrar.
              Las columnas muestran el flujo: triage → pendientes → por hacer → listo → en ejecución → revisión → hecho.
            </div>
          )}

          <WorkboardBoard
            cards={cards} agents={agents}
            viewMode={viewMode} hideEmpty={hideEmpty}
            filters={filters} diagnostics={diagnostics}
            onChanged={loadCards}
          />
        </>
      )}

      <NewCardModal agents={agents} open={showNew} onClose={() => setShowNew(false)} onCreated={loadCards} />
    </div>
  );
}
