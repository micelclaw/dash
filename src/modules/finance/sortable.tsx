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

// Orden de tablas reutilizable para las lentes Personal y Facturación. Cada tabla
// declara un mapa columna→accessor (valor comparable); el hook ordena y un `<SortableTh>`
// pinta la cabecera clicable con la flecha de dirección. Click alterna asc↔desc; click
// en otra columna empieza por asc. Comparación: numérica si ambos son número, si no
// localeCompare 'es' con numeric. Los null/undefined van siempre al final.

import { useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { CSSProperties } from 'react';

export type SortDir = 'asc' | 'desc';
export type SortValue = string | number | null | undefined;
export type Accessors<T> = Record<string, (row: T) => SortValue>;

export interface SortState {
  sortKey: string | null;
  sortDir: SortDir;
  /** Alterna el orden por una columna (asc → desc → asc…). */
  toggle: (key: string) => void;
}

/**
 * Ordena `rows` según la columna activa. `accessors` puede ser un objeto inline (se
 * lee de un ref, no entra en las deps del memo, así no re-ordena en cada render).
 */
export function useSortable<T>(rows: T[], accessors: Accessors<T>, initial?: { key: string; dir?: SortDir }) {
  const accRef = useRef(accessors);
  accRef.current = accessors;
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? 'asc');

  const sorted = useMemo(() => {
    const acc = sortKey ? accRef.current[sortKey] : undefined;
    if (!acc) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulos al final, independientemente de la dirección
      if (vb == null) return -1;
      let c: number;
      if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
      else c = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? c : -c;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggle = (key: string) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return key;
    });
  };

  return { sorted, sortKey, sortDir, toggle };
}

/** Cabecera `<th>` clicable con indicador de orden. `col` = clave del accessor. */
export function SortableTh({
  label, col, state, align = 'left', style,
}: {
  label: string;
  col: string;
  state: SortState;
  align?: CSSProperties['textAlign'];
  style?: CSSProperties;
}) {
  const active = state.sortKey === col;
  const base: CSSProperties = {
    textAlign: align, padding: '8px 10px', fontSize: 11, color: active ? 'var(--text)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 500, borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap', ...style,
  };
  const Icon = !active ? ChevronsUpDown : state.sortDir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th onClick={() => state.toggle(col)} style={base} title={`Ordenar por ${label}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}
        <Icon size={12} style={{ opacity: active ? 0.9 : 0.4, flexShrink: 0 }} />
      </span>
    </th>
  );
}
