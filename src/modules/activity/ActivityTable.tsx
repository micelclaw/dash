/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Generic table used by every Activity Center tab. Receives an Adapter
 * + the current rows, renders the column header and the body. Row
 * click toggles a right-side drawer with the adapter's detail view.
 *
 * Virtualization: not yet. With limit=500 we stay under a few thousand
 * rows in DOM, which the browser handles without trouble. If a tab
 * needs more (containers logs merged across 12 services), we'll wire
 * @tanstack/react-virtual then.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Adapter } from './adapters/types';

interface Props<Row> {
  adapter: Adapter<Row>;
  rows: Row[];
  loading: boolean;
  emptyMessage?: string;
}

export function ActivityTable<Row>({ adapter, rows, loading, emptyMessage = 'Sin entradas para los filtros actuales.' }: Props<Row>) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const getKey = adapter.getRowKey ?? ((row: Row) => String(rows.indexOf(row)));

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg-surface)]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--bg-base)] border-b border-[var(--border-base)]">
            <tr>
              {adapter.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left font-medium text-[var(--text-muted)] ${col.width ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={adapter.columns.length} className="px-3 py-8 text-center text-[var(--text-muted)]">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={adapter.columns.length} className="px-3 py-8 text-center text-[var(--text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getKey(row);
                const isSelected = selectedRow && getKey(selectedRow) === key;
                return (
                  <tr
                    key={key}
                    onClick={() => setSelectedRow(row)}
                    className={`cursor-pointer border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] ${
                      isSelected ? 'bg-[var(--bg-hover)]' : ''
                    }`}
                  >
                    {adapter.columns.map((col) => (
                      <td key={col.key} className={`px-3 py-1.5 align-top ${col.width ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <div className="w-[420px] border-l border-[var(--border-base)] bg-[var(--bg-base)] overflow-auto">
          <div className="flex items-center justify-between border-b border-[var(--border-base)] px-3 py-2">
            <span className="text-sm font-medium">Detalle</span>
            <button
              onClick={() => setSelectedRow(null)}
              className="p-1 rounded hover:bg-[var(--bg-hover)]"
              aria-label="Cerrar detalle"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-3">{adapter.renderDetail(selectedRow)}</div>
        </div>
      )}
    </div>
  );
}
