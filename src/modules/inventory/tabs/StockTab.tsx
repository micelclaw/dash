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

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpToLine, Download, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIsMobile } from '@/hooks/use-media-query';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { fmtMoney, type InventoryMove } from '@/modules/inventory/types';
import { moveEvidenceDownloadPath } from '@/modules/inventory/components/count-evidence';
import { useI18n } from '@/i18n';

const MOVE_TYPES = [
  'purchase_in',
  'sale_out',
  'consume',
  'transfer',
  'adjustment',
  'count_fix',
  'loan_out',
  'loan_return',
  'return_in',
  'reversal',
] as const;

/** Valid targets for bulk reclassification (reversal is never a valid target). */
const BULK_TYPES = [
  'purchase_in',
  'sale_out',
  'consume',
  'production_out',
  'return_in',
  'return_to_supplier',
  'transfer',
  'adjustment',
  'count_fix',
  'loan_out',
  'loan_return',
  'rental_out',
  'rental_return',
] as const;

const selectStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  padding: '5px 8px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
};

const primaryBtnStyle: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const secondaryBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--bg)',
  textTransform: 'uppercase',
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  textAlign: 'left',
  padding: '6px 10px',
  whiteSpace: 'nowrap',
  zIndex: 1,
};

const tdStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  verticalAlign: 'middle',
};

/** Fecha + hora compacta para una fila del ledger (DD MMM · HH:MM). */
function fmtMoveDateTime(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  return {
    date: d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' }),
    time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Construye y descarga un CSV del ledger filtrado (read-only, no toca el ledger). */
function exportMovesCsv(moves: InventoryMove[], itemName: (id: string) => string): void {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['datetime', 'type', 'item', 'qty_delta', 'uom', 'running_balance', 'unit_cost', 'currency', 'created_by', 'notes'];
  const rows = moves.map(m => [
    m.occurred_at, m.type, itemName(m.item_id), m.qty_delta, m.uom,
    m.running_balance ?? '', m.unit_cost ?? '', m.currency, m.created_by, m.notes ?? '',
  ].map(esc).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
      {label}
      {children}
    </label>
  );
}

function ModalShell({ title, width = 420, onClose, children }: { title: string; width?: number; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TypeChip({ type }: { type: string }) {
  const { t: tr } = useI18n();
  const reversal = type === 'reversal';
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.6875rem',
        padding: '1px 6px',
        borderRadius: 4,
        background: reversal ? 'color-mix(in srgb, var(--error) 12%, transparent)' : 'var(--surface)',
        color: reversal ? 'var(--error)' : 'var(--text-dim)',
        whiteSpace: 'nowrap',
      }}
    >
      {tr(`inventory.stock.type.${type}`)}
    </span>
  );
}

function DeltaCell({ move }: { move: InventoryMove }) {
  const n = parseFloat(move.qty_delta);
  const isTransfer = move.type === 'transfer';
  const color = isTransfer
    ? 'var(--text-dim)'
    : Number.isFinite(n) && n > 0
      ? 'var(--success)'
      : Number.isFinite(n) && n < 0
        ? 'var(--error)'
        : 'var(--text-dim)';
  const sign = Number.isFinite(n) && n > 0 ? '+' : '';
  return (
    <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
      {sign}{move.qty_delta}
    </span>
  );
}

function ByChip({ createdBy }: { createdBy: string }) {
  const { t: tr } = useI18n();
  const by = tr(/agent/i.test(createdBy) ? 'inventory.stock.agent' : 'inventory.stock.user');
  return (
    <span
      style={{
        background: 'var(--surface)',
        borderRadius: 999,
        padding: '1px 8px',
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        whiteSpace: 'nowrap',
      }}
    >
      {by}
    </span>
  );
}

type MoveMode = 'in' | 'out' | 'transfer';

const MODE_CONFIG: Record<MoveMode, { title: string; moveType: string; toastMsg: string; failedAction: string }> = {
  in: { title: 'inventory.stock.in', moveType: 'purchase_in', toastMsg: 'inventory.stock.inRecorded', failedAction: 'inventory.stock.in' },
  out: { title: 'inventory.stock.out', moveType: 'consume', toastMsg: 'inventory.stock.outRecorded', failedAction: 'inventory.stock.out' },
  transfer: { title: 'inventory.stock.transfer', moveType: 'transfer', toastMsg: 'inventory.stock.transferRecorded', failedAction: 'inventory.stock.transfer' },
};

function MoveModal({ mode, defaultItemId, onClose, onDone }: { mode: MoveMode; defaultItemId: string; onClose: () => void; onDone: () => void }) {
  const { t: tr } = useI18n();
  const { items, locations, recordMove } = useInventoryStore();
  const [itemId, setItemId] = useState(defaultItemId);
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cfg = MODE_CONFIG[mode];

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(b.track_stock) - Number(a.track_stock) || a.name.localeCompare(b.name)),
    [items],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemId) {
      toast.error(tr('inventory.stock.itemRequired'));
      return;
    }
    const qtyNum = parseFloat(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error(tr('inventory.stock.positiveQuantity'));
      return;
    }
    if (mode === 'transfer' && !toLocationId) {
      toast.error(tr('inventory.stock.destinationRequired'));
      return;
    }
    const body: Record<string, unknown> = {
      item_id: itemId,
      type: cfg.moveType,
      qty_delta: mode === 'out' ? -qtyNum : qtyNum,
    };
    if (mode === 'transfer') body.to_location_id = toLocationId;
    if (mode !== 'transfer' && unitCost !== '') {
      const cost = parseFloat(unitCost);
      if (Number.isFinite(cost)) body.unit_cost = cost;
    }
    if (notes.trim()) body.notes = notes.trim();

    setSubmitting(true);
    try {
      await recordMove(body);
      toast.success(tr(cfg.toastMsg));
      onDone();
    } catch {
      toast.error(tr('inventory.stock.recordFailed', { action: tr(cfg.failedAction).toLocaleLowerCase() }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={tr(cfg.title)} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label={`${tr('inventory.stock.item')} *`}>
          <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={itemId} onChange={e => setItemId(e.target.value)} autoFocus required>
            <option value="">{tr('inventory.stock.selectItem')}</option>
            {sortedItems.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={`${tr('inventory.stock.quantity')} *`}>
            <input style={inputStyle} type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} required />
          </Field>
          {mode !== 'transfer' && (
            <Field label={tr('inventory.stock.unitCost')}>
              <input style={inputStyle} type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
            </Field>
          )}
          {mode === 'transfer' && (
            <Field label={`${tr('inventory.stock.toLocation')} *`}>
              <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={toLocationId} onChange={e => setToLocationId(e.target.value)} required>
                <option value="">{tr('inventory.stock.selectLocation')}</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label={tr('inventory.stock.notes')}>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" style={secondaryBtnStyle} onClick={onClose}>{tr('inventory.cancel')}</button>
          <button type="submit" style={{ ...primaryBtnStyle, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
            {submitting ? tr('inventory.stock.recording') : tr(cfg.title)}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface ReceiptResult {
  vendor: string | null;
  order_ref: string | null;
  moves_created: Array<{ line: string }>;
  proposals_queued: number;
}

function ReceiveDocumentModal({ onClose, onProcessed }: { onClose: () => void; onProcessed: () => void }) {
  const { t: tr } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReceiptResult | null>(null);

  const handleProcess = async () => {
    if (!file || loading) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const form = new FormData();
      form.append('file', file);
      form.append('parent_folder', `/Inventory/receipts/${year}/`);
      const uploaded = await api.upload<{ data: { id: string } }>('/files/upload', form);
      const res = await api.post<{ data: ReceiptResult }>(
        '/inventory/moves/receipt',
        { file_id: uploaded.data.id },
        { timeout: 120000 },
      );
      setResult(res.data);
      toast.success(tr('inventory.stock.receiptProcessed', { count: res.data.moves_created.length }));
      onProcessed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('inventory.stock.receiptFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title={tr('inventory.stock.receiveDocument')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!result && (
          <>
            <Field label={tr('inventory.stock.deliveryNote')}>
              <input
                style={{ ...inputStyle, padding: '5px 8px', cursor: 'pointer' }}
                type="file"
                accept="application/pdf,image/*"
                disabled={loading}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>

            {loading && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                {tr('inventory.stock.ocrWorking')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" style={secondaryBtnStyle} onClick={onClose} disabled={loading}>{tr('inventory.cancel')}</button>
              <button
                type="button"
                style={{ ...primaryBtnStyle, opacity: !file || loading ? 0.6 : 1 }}
                disabled={!file || loading}
                onClick={() => void handleProcess()}
              >
                {loading ? tr('inventory.stock.processing') : tr('inventory.stock.processReceipt')}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 10,
                fontSize: '0.8125rem',
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div><span style={{ color: 'var(--text-dim)' }}>{tr('inventory.stock.vendor')}:</span> {result.vendor ?? '—'}</div>
              <div><span style={{ color: 'var(--text-dim)' }}>{tr('inventory.stock.orderRef')}:</span> {result.order_ref ?? '—'}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{tr('inventory.stock.movesCreated', { count: result.moves_created.length })}</div>
              {result.moves_created.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {result.moves_created.map((m, i) => (
                    <li key={i} style={{ fontSize: '0.75rem' }}>{m.line}</li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: 4, color: result.proposals_queued > 0 ? 'var(--mod-inventory)' : 'var(--text-dim)' }}>
                {tr('inventory.stock.proposalsQueued', { count: result.proposals_queued })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" style={primaryBtnStyle} onClick={onClose}>{tr('inventory.stock.close')}</button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export function StockTab() {
  const { t: tr, locale } = useI18n();
  const { items, moves, fetchMoves, fetchItems, fetchProposals, reverseMove } = useInventoryStore();
  const [itemFilter, setItemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reversingMove, setReversingMove] = useState<InventoryMove | null>(null);
  const [modal, setModal] = useState<MoveMode | 'receipt' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmingReverse, setConfirmingReverse] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    void fetchMoves({ limit: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (itemId: string, type: string) =>
    fetchMoves({ item_id: itemId || undefined, type: type || undefined, limit: 100 });

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(b.track_stock) - Number(a.track_stock) || a.name.localeCompare(b.name)),
    [items],
  );

  const itemNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) map.set(i.id, i.name);
    return map;
  }, [items]);

  // Resumen del ledger mostrado (read-only): conteo + entradas/salidas/neto.
  // Suma de los qty_delta positivos (in) y |negativos| (out) de lo cargado.
  const summary = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const m of moves) {
      const n = parseFloat(m.qty_delta);
      if (!Number.isFinite(n) || m.type === 'transfer') continue;
      if (n > 0) inSum += n;
      else if (n < 0) outSum += -n;
    }
    const fmt = (x: number) => Number.isInteger(x) ? String(x) : x.toFixed(2);
    return { count: moves.length, inSum, outSum, net: inSum - outSum, fmt };
  }, [moves]);

  const clearSelection = () => {
    setSelected(new Set());
    setConfirmingReverse(false);
  };

  const handleItemFilter = (value: string) => {
    setItemFilter(value);
    clearSelection();
    void load(value, typeFilter);
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    clearSelection();
    void load(itemFilter, value);
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingReverse(false);
  };

  const allSelected = moves.length > 0 && moves.every(m => selected.has(m.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(moves.map(m => m.id)));
    setConfirmingReverse(false);
  };

  const refreshAfterBulk = () => Promise.all([load(itemFilter, typeFilter), fetchItems()]);

  const handleBulkApply = async () => {
    if (!bulkType || bulkBusy || selected.size === 0) return;
    const selectedMoves = moves.filter(m => selected.has(m.id));
    const targets = selectedMoves.filter(m => m.type !== 'reversal');
    const skipped = selectedMoves.length - targets.length;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const m of targets) {
      try {
        await api.patch(`/inventory/moves/${m.id}`, { type: bulkType });
        ok++;
      } catch {
        failed++;
      }
    }
    await refreshAfterBulk();
    setBulkBusy(false);
    const parts = [tr('inventory.stock.bulkReclassified', { count: ok })];
    if (skipped > 0) parts.push(tr('inventory.stock.reversalsSkipped', { count: skipped }));
    if (failed > 0) parts.push(tr('inventory.stock.bulkFailed', { count: failed }));
    if (failed > 0) toast.warning(parts.join(' — '));
    else toast.success(parts.join(' — '));
    clearSelection();
    setBulkType('');
  };

  // Reversión en lote: NO borra el ledger (es INMUTABLE) — registra un
  // contra-asiento por cada movimiento seleccionado reversible. Los movimientos
  // que ya son reversal (o ya están revertidos) se omiten.
  const handleBulkReverse = async () => {
    if (bulkBusy || selected.size === 0) return;
    if (!confirmingReverse) {
      setConfirmingReverse(true);
      return;
    }
    const selectedMoves = moves.filter(m => selected.has(m.id));
    const targets = selectedMoves.filter(m => m.type !== 'reversal' && m.ref_type !== 'reversal');
    const skipped = selectedMoves.length - targets.length;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targets.map(m => api.post(`/inventory/moves/${m.id}/reverse`)),
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    await refreshAfterBulk();
    setBulkBusy(false);
    const parts = [tr('inventory.stock.reversed', { count: ok })];
    if (skipped > 0) parts.push(tr('inventory.stock.alreadyReversalSkipped', { count: skipped }));
    if (failed > 0) parts.push(tr('inventory.stock.bulkFailed', { count: failed }));
    if (failed > 0) toast.warning(parts.join(' — '));
    else toast.success(parts.join(' — '));
    clearSelection();
  };

  const handleUndo = (move: InventoryMove) => setReversingMove(move);

  const confirmUndo = async () => {
    if (!reversingMove) return;
    try {
      await reverseMove(reversingMove.id);
      toast.success(tr('inventory.stock.reversalRecorded'));
      void load(itemFilter, typeFilter);
    } catch {
      toast.error(tr('inventory.stock.reverseFailed'));
    }
    setReversingMove(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg)',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <select style={selectStyle} value={itemFilter} onChange={e => handleItemFilter(e.target.value)}>
          <option value="">{tr('inventory.stock.allItems')}</option>
          {sortedItems.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        <select style={selectStyle} value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}>
          <option value="">{tr('inventory.stock.allTypes')}</option>
          {MOVE_TYPES.map(t => (
            <option key={t} value={t}>{tr(`inventory.stock.type.${t}`)}</option>
          ))}
        </select>

        <div style={isMobile ? { display: 'flex', gap: 8, flexWrap: 'wrap' } : { marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            style={{ ...secondaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: moves.length === 0 ? 0.5 : 1 }}
            disabled={moves.length === 0}
            onClick={() => exportMovesCsv(moves, id => itemNames.get(id) ?? id)}
            title={tr('inventory.stock.exportLedger')}
          >
            <Download size={13} /> {tr('inventory.stock.exportCsv')}
          </button>
          <button style={secondaryBtnStyle} onClick={() => setModal('in')}>{tr('inventory.stock.in')}</button>
          <button style={secondaryBtnStyle} onClick={() => setModal('out')}>{tr('inventory.stock.out')}</button>
          <button style={secondaryBtnStyle} onClick={() => setModal('transfer')}>{tr('inventory.stock.transfer')}</button>
          <button style={primaryBtnStyle} onClick={() => setModal('receipt')}>{tr('inventory.stock.receiveDocument')}</button>
        </div>
      </div>

      {/* Resumen del ledger mostrado */}
      {moves.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '7px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            flexWrap: 'wrap',
          }}
        >
          <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{tr('inventory.stock.movements', { count: summary.count })}</span>{itemFilter || typeFilter ? ` ${tr('inventory.stock.filtered')}` : ''}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowDownToLine size={12} style={{ color: 'var(--success)' }} />
            {tr('inventory.stock.inLabel')} <span style={{ color: 'var(--success)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>+{summary.fmt(summary.inSum)}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpToLine size={12} style={{ color: 'var(--error)' }} />
            {tr('inventory.stock.outLabel')} <span style={{ color: 'var(--error)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>-{summary.fmt(summary.outSum)}</span>
          </span>
          <span>{tr('inventory.stock.net')} <span style={{ color: summary.net >= 0 ? 'var(--success)' : 'var(--error)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{summary.net >= 0 ? '+' : ''}{summary.fmt(summary.net)}</span></span>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            margin: '8px 16px 0',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {tr('inventory.stock.selected', { count: selected.size })}
          </span>

          <select style={selectStyle} value={bulkType} onChange={e => setBulkType(e.target.value)} disabled={bulkBusy}>
            <option value="">{tr('inventory.stock.changeType')}</option>
            {BULK_TYPES.map(t => (
              <option key={t} value={t}>{tr(`inventory.stock.type.${t}`)}</option>
            ))}
          </select>

          <button
            style={{ ...primaryBtnStyle, opacity: !bulkType || bulkBusy ? 0.6 : 1 }}
            disabled={!bulkType || bulkBusy}
            onClick={() => void handleBulkApply()}
          >
            {bulkBusy ? tr('inventory.stock.working') : tr('inventory.stock.apply')}
          </button>

          <button
            title={tr('inventory.stock.reverseTitle')}
            style={{
              ...secondaryBtnStyle,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              ...(confirmingReverse
                ? { background: 'var(--warning)', border: '1px solid var(--warning)', color: '#06060a', fontWeight: 600 }
                : { color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)' }),
              opacity: bulkBusy ? 0.6 : 1,
            }}
            disabled={bulkBusy}
            onClick={() => void handleBulkReverse()}
          >
            <Undo2 size={13} /> {confirmingReverse ? tr('inventory.stock.confirmReverse', { count: selected.size }) : tr('inventory.stock.reverse')}
          </button>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              padding: '6px 8px',
            }}
            disabled={bulkBusy}
            onClick={clearSelection}
          >
            {tr('inventory.stock.clear')}
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {moves.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title={tr('inventory.stock.noMoves')}
            description={tr('inventory.stock.noMovesDescription')}
            actions={[
              { label: tr('inventory.stock.in'), onClick: () => setModal('in'), variant: 'primary' },
              { label: tr('inventory.stock.receiveDocument'), onClick: () => setModal('receipt'), variant: 'secondary' },
            ]}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 28 }}>
                  <input
                    type="checkbox"
                    aria-label={tr('inventory.stock.selectAll')}
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--amber)', cursor: 'pointer' }}
                  />
                </th>
                <th style={thStyle}>{tr('inventory.stock.date')}</th>
                <th style={thStyle}>{tr('inventory.stock.type')}</th>
                <th style={thStyle}>{tr('inventory.stock.item')}</th>
                <th style={thStyle}>Δ</th>
                <th style={thStyle}>{tr('inventory.stock.balance')}</th>
                <th style={thStyle}>{tr('inventory.stock.cost')}</th>
                <th style={thStyle}>{tr('inventory.stock.by')}</th>
                <th style={thStyle}>{tr('inventory.stock.evidence')}</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {moves.map(move => (
                <tr
                  key={move.id}
                  style={{ background: selected.has(move.id) ? 'var(--surface-hover)' : 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected.has(move.id) ? 'var(--surface-hover)' : 'transparent'; }}
                >
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      aria-label={tr('inventory.stock.selectMove')}
                      checked={selected.has(move.id)}
                      onChange={() => toggleRow(move.id)}
                      style={{ accentColor: 'var(--amber)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {(() => {
                      const dt = fmtMoveDateTime(move.occurred_at, locale);
                      return (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25 }}>
                          <span>{dt.date}</span>
                          {dt.time && <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{dt.time}</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={tdStyle}><TypeChip type={move.type} /></td>
                  <td style={tdStyle}>
                    {itemNames.get(move.item_id) ?? (
                      <span style={{ color: 'var(--text-dim)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem' }}>
                        {move.item_id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}><DeltaCell move={move} /></td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {itemFilter && move.running_balance != null
                      ? move.running_balance
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>{fmtMoney(move.unit_cost, move.currency)}</td>
                  <td style={tdStyle}><ByChip createdBy={move.created_by} /></td>
                  <td style={tdStyle}>
                    {moveEvidenceDownloadPath(move.doc_file_id) ? (
                      <a
                        href={api.mediaUrl(moveEvidenceDownloadPath(move.doc_file_id)!)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--amber)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={12} /> {tr('inventory.stock.photo')}
                      </a>
                    ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {move.type !== 'reversal' && move.ref_type !== 'reversal' && (
                      <button
                        onClick={() => void handleUndo(move)}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <Undo2 size={12} /> {tr('inventory.stock.undo')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.6875rem',
          color: 'var(--text-dim)',
        }}
      >
        {tr('inventory.stock.footer')}
      </div>

      {(modal === 'in' || modal === 'out' || modal === 'transfer') && (
        <MoveModal
          mode={modal}
          defaultItemId={itemFilter}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load(itemFilter, typeFilter);
          }}
        />
      )}

      {modal === 'receipt' && (
        <ReceiveDocumentModal
          onClose={() => setModal(null)}
          onProcessed={() => {
            void load(itemFilter, typeFilter);
            void fetchProposals();
          }}
        />
      )}

      <ConfirmDialog
        open={!!reversingMove}
        onClose={() => setReversingMove(null)}
        onConfirm={confirmUndo}
        title={tr('inventory.stock.reverseMove')}
        description={tr('inventory.stock.reverseDescription')}
        confirmLabel={tr('inventory.stock.reverse')}
        cancelLabel={tr('inventory.cancel')}
        variant="warning"
      />
    </div>
  );
}
