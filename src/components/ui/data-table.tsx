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
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import { Checkbox } from './checkbox';
import { cn } from '@/lib/utils';

export interface DataColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Cómo pintar la celda. Por defecto String(row[key]). */
  render?: (row: T) => React.ReactNode;
  /** Valor para ordenar (string/number). Por defecto el render textual o row[key]. */
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Selección por checkbox (col extra a la izquierda). */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: React.ReactNode;
  loading?: boolean;
}

export function DataTable<T>({
  columns, rows, getRowKey, onRowClick, selectable, selectedKeys, onSelectionChange, initialSort, empty, loading,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: T): string | number => {
      if (col.sortValue) return col.sortValue(r);
      const raw = (r as Record<string, unknown>)[col.key];
      return typeof raw === 'number' ? raw : String(raw ?? '').toLowerCase();
    };
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const allKeys = rows.map(getRowKey);
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selectedKeys?.has(k));
  const someSelected = selectable && allKeys.some((k) => selectedKeys?.has(k));
  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(allKeys));
  };
  const toggleOne = (k: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    next.has(k) ? next.delete(k) : next.add(k);
    onSelectionChange(next);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {selectable && (
            <TableHead className="w-8">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todo"
              />
            </TableHead>
          )}
          {columns.map((c) => (
            <TableHead key={c.key} style={c.width ? { width: c.width } : undefined} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>
              {c.sortable ? (
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors"
                >
                  {c.header}
                  {sort?.key === c.key
                    ? (sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                </button>
              ) : c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow className="hover:bg-transparent"><TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-8 text-center text-[var(--text-dim)]">Cargando…</TableCell></TableRow>
        ) : sorted.length === 0 ? (
          <TableRow className="hover:bg-transparent"><TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-8 text-center text-[var(--text-dim)]">{empty ?? 'Sin elementos'}</TableCell></TableRow>
        ) : sorted.map((row) => {
          const k = getRowKey(row);
          return (
            <TableRow
              key={k}
              data-state={selectedKeys?.has(k) ? 'selected' : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {selectable && (
                <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedKeys?.has(k) ?? false} onCheckedChange={() => toggleOne(k)} aria-label="Seleccionar fila" />
                </TableCell>
              )}
              {columns.map((c) => (
                <TableCell key={c.key} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
