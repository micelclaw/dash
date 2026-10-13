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
import { WorkboardCardView } from './WorkboardCard';
import { CardDetailModal } from './CardDetailModal';
import { buildDiagIndex } from './pills';
import { buildColumns, passesFilters } from './filtering';
import type { WorkboardCard, WorkboardDiagnostic } from './types';
import type { ManagedAgent } from '../types';
import type { ViewMode, WorkboardFilters } from './WorkboardToolbar';

interface Props {
  cards: WorkboardCard[];
  agents: ManagedAgent[];
  viewMode: ViewMode;
  hideEmpty: boolean;
  filters: WorkboardFilters;
  diagnostics: WorkboardDiagnostic[];
  onChanged: () => void;
}

/**
 * Board móvil "selector + lista": tira de chips (una columna de la vista actual) que navega, y
 * lista vertical a todo el ancho de la columna seleccionada. Sin scroll horizontal ni DnD (el
 * movimiento va por los botones "Mover a" del modal de detalle).
 */
export function WorkboardMobileBoard({ cards, agents, viewMode, hideEmpty, filters, diagnostics, onChanged }: Props) {
  const [selected, setSelected] = useState<WorkboardCard | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const diagIndex = useMemo(() => buildDiagIndex(diagnostics), [diagnostics]);
  const live = selected ? cards.find((c) => c.id === selected.id) ?? selected : null;

  const visible = useMemo(() => cards.filter((c) => passesFilters(c, filters, diagIndex)), [cards, filters, diagIndex]);
  const columns = useMemo(() => {
    const cols = buildColumns(viewMode).map((col) => ({
      col,
      laneCards: visible.filter((c) => col.statuses.includes(c.status)).sort((a, b) => a.position - b.position),
    }));
    return hideEmpty ? cols.filter(({ laneCards }) => laneCards.length > 0) : cols;
  }, [viewMode, visible, hideEmpty]);

  // Columna activa: la seleccionada si sigue existiendo; si no, la primera no vacía (o la primera).
  const activeKey = (selectedKey && columns.some((v) => v.col.key === selectedKey))
    ? selectedKey
    : (columns.find((v) => v.laneCards.length > 0)?.col.key ?? columns[0]?.col.key ?? null);
  const active = columns.find((v) => v.col.key === activeKey);

  if (columns.length === 0) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center' }}>Ninguna tarjeta coincide con los filtros.</div>;
  }

  return (
    <>
      {/* Selector de fase (chips, scroll horizontal sin comprimir) */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
        {columns.map(({ col, laneCards }) => {
          const on = col.key === activeKey;
          return (
            <button
              key={col.key}
              onClick={() => setSelectedKey(col.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
                minHeight: 40, padding: '8px 13px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${on ? col.accent : 'var(--border)'}`,
                background: on ? 'var(--bg-subtle, rgba(127,127,127,0.16))' : 'transparent',
                color: on ? 'var(--text)' : 'var(--text-dim)', fontSize: '0.8125rem', fontWeight: on ? 600 : 400,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.accent }} />
              {col.label}
              <span style={{ color: on ? col.accent : 'var(--text-muted)', fontWeight: 700 }}>{laneCards.length}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de la fase activa */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {(active?.laneCards ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelected(c); setOpen(true); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
          >
            <WorkboardCardView card={c} agents={agents} />
          </button>
        ))}
        {(active?.laneCards.length ?? 0) === 0 && (
          <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center' }}>Sin tarjetas en esta fase.</div>
        )}
      </div>

      <CardDetailModal card={live} agents={agents} diagnostics={diagnostics} open={open} onClose={() => setOpen(false)} onChanged={onChanged} />
    </>
  );
}
