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

// P4b — Importar movimientos desde CSV. Pega o sube un CSV, mapea las columnas
// (fecha/importe/concepto), elige la cuenta-monedero destino y previsualiza antes
// de importar. El signo del importe define el tipo (negativo=Gasto, positivo=Ingreso).

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, FileUp } from 'lucide-react';
import { useFinancePersonalStore, type MovementInput } from '@/stores/finance-personal.store';
import { fmtMoney } from './lib';

// ── Parser CSV simple y robusto ──────────────────────────────────────
/** Detecta el delimitador dominante de la primera línea (coma o punto y coma). */
function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

/** Quita comillas dobles envolventes de una celda. */
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).trim();
  return t;
}

/** Parsea el texto CSV a una matriz de celdas (split simple por delimitador). */
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);
  return lines.map((line) => line.split(delim).map(unquote));
}

/** Parsea un importe con coma decimal y/o separadores de miles a número (o null). */
function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) {
    // '.' = miles, ',' = decimal → 1.234,56 → 1234.56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // solo coma → decimal
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza una fecha a 'YYYY-MM-DD' o null si no parsea. */
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s); // DD/MM/YYYY o DD-MM-YYYY
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  return null;
}

interface ParsedRow {
  date: string;
  amount: number; // firmado
  description: string;
}

// Auto-detección de columnas por nombre de cabecera.
const DATE_HINTS = ['fecha', 'date'];
const AMOUNT_HINTS = ['importe', 'amount', 'cantidad'];
const DESC_HINTS = ['concepto', 'descripcion', 'descripción', 'description', 'detalle'];

function detectColumn(headers: string[], hints: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    if (hints.some((hint) => h.includes(hint))) return i;
  }
  return -1;
}

export function ImportCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, importTransactions } = useFinancePersonalStore();
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [dateCol, setDateCol] = useState(-1);
  const [amountCol, setAmountCol] = useState(-1);
  const [descCol, setDescCol] = useState(-1);
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  // Guarda si el usuario ya tocó manualmente los mapeos para no pisarlos en el auto-detect.
  const touchedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const assetAccounts = accounts.filter((a) => a.type === 'asset' || a.type === 'liability');

  // Matriz de celdas y cabecera derivada.
  const matrix = useMemo(() => parseCsv(text), [text]);
  const headerRow = hasHeader && matrix.length > 0 ? matrix[0] : [];
  const colCount = matrix.reduce((max, r) => Math.max(max, r.length), 0);

  // Auto-detección de columnas: solo si el usuario no las ha tocado.
  const autoDetectKey = `${headerRow.join('|')}::${colCount}`;
  useEffect(() => {
    if (touchedRef.current) return;
    if (hasHeader && headerRow.length > 0) {
      const d = detectColumn(headerRow, DATE_HINTS);
      const a = detectColumn(headerRow, AMOUNT_HINTS);
      const c = detectColumn(headerRow, DESC_HINTS);
      setDateCol(d >= 0 ? d : 0);
      setAmountCol(a >= 0 ? a : colCount > 1 ? 1 : -1);
      setDescCol(c >= 0 ? c : colCount > 2 ? 2 : -1);
    } else if (colCount > 0) {
      setDateCol(0);
      setAmountCol(colCount > 1 ? 1 : -1);
      setDescCol(colCount > 2 ? 2 : -1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectKey, hasHeader]);

  // Filas de datos (sin cabecera si procede) parseadas y clasificadas.
  const { valid, invalid } = useMemo(() => {
    const dataRows = hasHeader ? matrix.slice(1) : matrix;
    const out: ParsedRow[] = [];
    let bad = 0;
    if (dateCol < 0 || amountCol < 0) return { valid: out, invalid: bad };
    for (const row of dataRows) {
      const date = parseDate(row[dateCol] ?? '');
      const amount = parseAmount(row[amountCol] ?? '');
      const description = descCol >= 0 ? (row[descCol] ?? '').trim() : '';
      if (date == null || amount == null || amount === 0) { bad++; continue; }
      out.push({ date, amount, description });
    }
    return { valid: out, invalid: bad };
  }, [matrix, hasHeader, dateCol, amountCol, descCol]);

  if (!open) return null;

  const close = () => {
    onClose();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      touchedRef.current = false;
      setText(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const setMapped = (setter: (n: number) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    touchedRef.current = true;
    setter(Number(e.target.value));
  };

  const canImport = valid.length > 0 && !!accountId && dateCol >= 0 && amountCol >= 0 && !busy;

  const doImport = async () => {
    if (!canImport) return;
    const rows: MovementInput[] = valid.map((r) => ({
      kind: r.amount < 0 ? 'expense' : 'income',
      account_id: accountId,
      amount: String(Math.abs(r.amount)),
      date: r.date,
      description: r.description || null,
    }));
    setBusy(true);
    try {
      const { created, failed } = await importTransactions(rows);
      if (created === 0) {
        toast.error('No se importó ningún movimiento');
      } else {
        toast.success(`Importados ${created} movimientos${failed.length ? `, ${failed.length} con error` : ''}`);
        close();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setBusy(false);
    }
  };

  // ── Estilos compartidos ────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' };
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)' };

  const colLabel = (i: number) => (headerRow[i]?.trim() ? headerRow[i].trim() : `Columna ${i + 1}`);
  const colOptions = Array.from({ length: colCount }, (_, i) => i);

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileUp size={18} style={{ color: 'var(--mod-finance)' }} /> Importar movimientos desde CSV
          </h2>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Entrada: textarea + fichero */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Pega el CSV o sube un fichero</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}
              >
                <FileUp size={13} /> Subir .csv
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} style={{ display: 'none' }} />
            </div>
            <textarea
              value={text}
              onChange={(e) => { touchedRef.current = false; setText(e.target.value); }}
              placeholder={'fecha,importe,concepto\n2026-06-01,-45.20,Supermercado'}
              spellCheck={false}
              style={{ ...fieldStyle, minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.5 }}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasHeader} onChange={(e) => { touchedRef.current = false; setHasHeader(e.target.checked); }} />
              La primera fila es cabecera
            </label>
          </div>

          {colCount > 0 && (
            <>
              {/* Mapeo de columnas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Columna de Fecha</label>
                  <select value={dateCol} onChange={setMapped(setDateCol)} style={fieldStyle}>
                    <option value={-1}>— elige —</option>
                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Columna de Importe</label>
                  <select value={amountCol} onChange={setMapped(setAmountCol)} style={fieldStyle}>
                    <option value={-1}>— elige —</option>
                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Columna de Concepto (opcional)</label>
                  <select value={descCol} onChange={setMapped(setDescCol)} style={fieldStyle}>
                    <option value={-1}>— ninguna —</option>
                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                  </select>
                </div>
              </div>

              {/* Cuenta destino */}
              <div>
                <label style={labelStyle}>Cuenta destino</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={fieldStyle}>
                  <option value="">— elige cuenta —</option>
                  {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Previsualización */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Previsualización</label>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--mod-finance)' }}>{valid.length}</span> válida{valid.length === 1 ? '' : 's'}
                    {invalid > 0 && <> · <span style={{ color: 'var(--amber)' }}>{invalid}</span> descartada{invalid === 1 ? '' : 's'}</>}
                  </span>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Fecha</th>
                        <th style={th}>Tipo</th>
                        <th style={{ ...th, textAlign: 'right' }}>Importe</th>
                        <th style={th}>Concepto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valid.length === 0 && (
                        <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={4}>
                          {colCount > 0 ? 'Sin filas válidas. Revisa el mapeo de columnas.' : 'Pega un CSV arriba.'}
                        </td></tr>
                      )}
                      {valid.slice(0, 8).map((r, i) => {
                        const isExpense = r.amount < 0;
                        return (
                          <tr key={i}>
                            <td style={{ ...td, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{r.date}</td>
                            <td style={{ ...td, color: isExpense ? '#ef4444' : 'var(--mod-finance)' }}>{isExpense ? 'Gasto' : 'Ingreso'}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: isExpense ? '#ef4444' : 'var(--mod-finance)' }}>
                              {isExpense ? '-' : '+'}{fmtMoney(Math.abs(r.amount))}
                            </td>
                            <td style={{ ...td, color: 'var(--text)' }}>{r.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                          </tr>
                        );
                      })}
                      {valid.length > 8 && (
                        <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={4}>… y {valid.length - 8} más</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={close} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={doImport} disabled={!canImport} style={{ padding: '8px 16px', background: canImport ? 'var(--amber)' : 'var(--bg)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: canImport ? '#0a0a0a' : 'var(--text-muted)', cursor: busy ? 'wait' : canImport ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
            {busy ? 'Importando…' : `Importar ${valid.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
