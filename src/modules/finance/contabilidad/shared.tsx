/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Helpers compartidos de la lente Contabilidad: formato, exportación CSV, tabla
// de informe (búsqueda + orden + exportar sobre el DataTable canónico), glosario
// de jerga (tooltips) y selector de cuenta con búsqueda.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, Search, ChevronsUpDown, FileSpreadsheet, FileText, Table2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { api } from '@/services/api';
import { useFinancePeriod } from '../period';
import { downloadExport, type ExportFormat } from '../lib/exportDownload';
import { fmt } from '../lib/format';

// `fmt` (número monetario sin símbolo) = SSOT en ../lib/format; se re-exporta para
// los consumidores de shared que hacen `import { fmt } from './shared'`.
export { fmt };

/** Celda monetaria: monoespaciada, alineada a la derecha, roja si negativa. */
export function Money({ v, color }: { v: string | number | null | undefined; color?: boolean }) {
  const n = Number(v ?? 0);
  return <span className="font-mono tabular-nums" style={color ? { color: n < 0 ? 'var(--red)' : 'var(--text)' } : undefined}>{fmt(v)}</span>;
}

/** Descarga un CSV (delimitador ';' + BOM UTF-8 → Excel ES lo abre bien). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) => {
    const s = String(c ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Glosario de jerga + Tip: SSOT en ../lib/glossary (compartido por las 3 lentes).
// Import (binding local para `typeof GLOSSARY` y `<Tip>` de ReportTable) + re-export
// para no tocar los consumidores de contabilidad que los importan de './shared'.
import { GLOSSARY, Tip } from '../lib/glossary';
export { GLOSSARY, Tip };

// ─── Tabla de informe (búsqueda + orden + exportar alrededor del DataTable) ───
interface ReportTableProps<T> {
  title?: ReactNode;
  tip?: keyof typeof GLOSSARY | string;
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  loading?: boolean;
  empty?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  exportName?: string;
  exportHeaders?: string[];
  exportRow?: (row: T) => (string | number)[];
  // Export de servidor (CSV/XLSX/PDF completos vía /finance/export/<serverReport>).
  serverReport?: string;
  serverExtra?: { accountId?: string; book?: 'issued' | 'received' };
}

/** Menú de exportación: CSV de la vista (cliente) + CSV/XLSX/PDF completos (servidor). */
export function ExportMenu({ clientCsv, serverReport, serverExtra }: { clientCsv?: () => void; serverReport?: string; serverExtra?: { accountId?: string; book?: 'issued' | 'received' } }) {
  const { range } = useFinancePeriod();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc); }, []);
  const server = async (format: ExportFormat) => {
    if (!serverReport) return;
    setBusy(format);
    try { await downloadExport(serverReport, { format, from: range.from, to: range.to, ...serverExtra }); setOpen(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo exportar'); }
    finally { setBusy(null); }
  };
  const item = 'w-full text-left px-3 py-1.5 hover:bg-[var(--surface)] flex items-center gap-2 text-[var(--text)]';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)]">
        <Download size={13} /> Exportar
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-[var(--radius-md,8px)] border border-[var(--border)] bg-[var(--card)] shadow-lg py-1 text-xs">
          {clientCsv && <button type="button" onClick={() => { clientCsv(); setOpen(false); }} className={item}><Table2 size={13} /> CSV (vista actual)</button>}
          {serverReport && <>
            <button type="button" disabled={!!busy} onClick={() => void server('csv')} className={item}>{busy === 'csv' ? <Loader2 size={13} className="animate-spin" /> : <Table2 size={13} />} CSV completo</button>
            <button type="button" disabled={!!busy} onClick={() => void server('xlsx')} className={item}>{busy === 'xlsx' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel (XLSX)</button>
            <button type="button" disabled={!!busy} onClick={() => void server('pdf')} className={item}>{busy === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF</button>
          </>}
        </div>
      )}
    </div>
  );
}

export function ReportTable<T>(p: ReportTableProps<T>) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim() || !p.search) return p.rows;
    const needle = q.toLowerCase();
    return p.rows.filter((r) => p.search!(r).toLowerCase().includes(needle));
  }, [p.rows, q, p.search]);

  const doExport = () => {
    if (!p.exportName || !p.exportHeaders || !p.exportRow) return;
    downloadCsv(p.exportName, p.exportHeaders, filtered.map(p.exportRow));
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {(p.title || p.search || p.exportName || p.right) && (
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-wrap">
          {p.title && <div className="text-[13px] font-semibold text-[var(--text)] flex items-center gap-1.5">{p.title}{p.tip && <Tip k={p.tip} />}</div>}
          <div className="flex-1" />
          {p.right}
          {p.search && (
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.searchPlaceholder ?? 'Buscar…'}
                className="pl-7 pr-2 py-1.5 w-44 text-xs rounded-[var(--radius-sm,4px)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--mod-finance)]" />
            </div>
          )}
          {(p.serverReport || (p.exportName && p.exportHeaders && p.exportRow)) && (
            <ExportMenu clientCsv={p.exportName && p.exportHeaders && p.exportRow ? doExport : undefined} serverReport={p.serverReport} serverExtra={p.serverExtra} />
          )}
        </div>
      )}
      <DataTable columns={p.columns} rows={filtered} getRowKey={p.getRowKey} onRowClick={p.onRowClick} initialSort={p.initialSort} loading={p.loading} empty={p.empty} />
      {p.footer}
    </div>
  );
}

// ─── Cuentas (hook + selector con búsqueda) ──────────────────────────────────
export interface Account {
  id: string; code: string | null; group_code: string | null; name: string; type: string;
  subtype: string | null; is_postable: boolean; parent_account_id: string | null;
  currency: string; external_ref: Record<string, unknown> | null; metadata: Record<string, unknown> | null;
  is_active: boolean; balance?: string;
}

export function useAccounts(includeSystem = true) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try { setAccounts((await api.get<{ data: Account[] }>(`/finance/accounts${includeSystem ? '?include_system=true' : ''}`)).data ?? []); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [includeSystem]);
  return { accounts, loading, reload };
}

/** Selector de cuenta con búsqueda por código o nombre (combobox ligero). */
export function AccountSelect({ accounts, value, onChange, placeholder = 'Cuenta…', postableOnly = false }: {
  accounts: Account[]; value: string; onChange: (id: string) => void; placeholder?: string; postableOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const pool = useMemo(() => accounts.filter((a) => !postableOnly || a.is_postable), [accounts, postableOnly]);
  const sel = pool.find((a) => a.id === value);
  const list = useMemo(() => {
    const n = q.toLowerCase();
    return pool.filter((a) => !n || `${a.code ?? ''} ${a.name}`.toLowerCase().includes(n)).slice(0, 60);
  }, [pool, q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full inline-flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded-[var(--radius-sm,4px)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--mod-finance)]">
        <span className="truncate">{sel ? <><span className="font-mono text-[var(--text-dim)]">{sel.code ?? ''}</span> {sel.name}</> : <span className="text-[var(--text-dim)]">{placeholder}</span>}</span>
        <ChevronsUpDown size={13} className="opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[280px] max-h-72 overflow-auto rounded-[var(--radius-md,8px)] border border-[var(--border)] bg-[var(--card)] shadow-lg">
          <div className="sticky top-0 p-1.5 bg-[var(--card)] border-b border-[var(--border)]">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuenta…"
              className="w-full px-2 py-1.5 text-xs rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none" />
          </div>
          {list.map((a) => (
            <button key={a.id} type="button" onClick={() => { onChange(a.id); setOpen(false); setQ(''); }}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--surface)] text-[var(--text)] flex items-center gap-2">
              <span className="font-mono text-[var(--text-dim)] w-10 shrink-0">{a.code ?? '—'}</span>
              <span className="truncate">{a.name}</span>
            </button>
          ))}
          {list.length === 0 && <div className="px-2.5 py-3 text-xs text-[var(--text-dim)]">Sin resultados</div>}
        </div>
      )}
    </div>
  );
}

// ─── Catálogo del plan estándar (PGC) — disponible al crear una cuenta ───────
export interface ChartAccount { code: string; name: string; type: string; group_code: string; is_postable: boolean; }
export function useStandardPlan(): ChartAccount[] {
  const [plan, setPlan] = useState<ChartAccount[]>([]);
  useEffect(() => { api.get<{ data: { accounts: ChartAccount[] } }>('/finance/accounts/standard-plan').then((r) => setPlan(r.data?.accounts ?? [])).catch(() => {}); }, []);
  return plan;
}

/** Picker para "partir de" una cuenta del plan estándar (PGC), agrupado por grupo. */
export function StandardAccountPicker({ plan, onPick }: { plan: ChartAccount[]; onPick: (a: ChartAccount) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => { const n = q.toLowerCase(); return plan.filter((a) => !n || `${a.code} ${a.name}`.toLowerCase().includes(n)).slice(0, 120); }, [plan, q]);
  useEffect(() => { const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc); }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full inline-flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded-[var(--radius-sm,4px)] bg-[var(--bg)] border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--mod-finance)]">
        <span className="inline-flex items-center gap-1.5"><Search size={13} /> Buscar en el plan PGC (572 Bancos, 700 Ventas, 629 Gastos…)</span>
        <ChevronsUpDown size={13} className="opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-[var(--radius-md,8px)] border border-[var(--border)] bg-[var(--card)] shadow-lg">
          <div className="sticky top-0 p-1.5 bg-[var(--card)] border-b border-[var(--border)]">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o nombre…"
              className="w-full px-2 py-1.5 text-xs rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none" />
          </div>
          {list.map((a) => (
            <button key={a.code} type="button" onClick={() => { onPick(a); setOpen(false); setQ(''); }}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--surface)] text-[var(--text)] flex items-center gap-2">
              <span className="font-mono text-[var(--text-dim)] w-10 shrink-0">{a.code}</span>
              <span className="truncate flex-1">{a.name}</span>
              <span className="text-[10px] text-[var(--text-dim)]">{ACCOUNT_TYPE_LABEL[a.type] ?? a.type}</span>
            </button>
          ))}
          {list.length === 0 && <div className="px-2.5 py-3 text-xs text-[var(--text-dim)]">Sin resultados</div>}
        </div>
      )}
    </div>
  );
}

export const PGC_GROUPS: Record<string, string> = {
  '1': 'Grupo 1 · Financiación básica',
  '2': 'Grupo 2 · Activo no corriente',
  '3': 'Grupo 3 · Existencias',
  '4': 'Grupo 4 · Acreedores y deudores',
  '5': 'Grupo 5 · Cuentas financieras',
  '6': 'Grupo 6 · Compras y gastos',
  '7': 'Grupo 7 · Ventas e ingresos',
};

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset: 'Activo', liability: 'Pasivo', equity: 'Patrimonio', income: 'Ingreso', expense: 'Gasto',
};
