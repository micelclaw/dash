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
import { ArrowRightLeft, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { fmtMoney, type InventoryMove } from '@/modules/inventory/types';

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
  const reversal = type === 'reversal';
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.6875rem',
        padding: '1px 6px',
        borderRadius: 4,
        background: reversal ? 'rgba(244,63,94,.12)' : 'var(--surface)',
        color: reversal ? 'rgba(244,63,94,.8)' : 'var(--text-dim)',
        whiteSpace: 'nowrap',
      }}
    >
      {type}
    </span>
  );
}

function DeltaCell({ move }: { move: InventoryMove }) {
  const n = parseFloat(move.qty_delta);
  const isTransfer = move.type === 'transfer';
  const color = isTransfer
    ? 'var(--text-dim)'
    : Number.isFinite(n) && n > 0
      ? '#22c55e'
      : Number.isFinite(n) && n < 0
        ? '#f43f5e'
        : 'var(--text-dim)';
  const sign = Number.isFinite(n) && n > 0 ? '+' : '';
  return (
    <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
      {sign}{move.qty_delta}
    </span>
  );
}

function ByChip({ createdBy }: { createdBy: string }) {
  const by = /agent/i.test(createdBy) ? 'agent' : 'user';
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

const MODE_CONFIG: Record<MoveMode, { title: string; moveType: string; toastMsg: string }> = {
  in: { title: 'Stock in', moveType: 'purchase_in', toastMsg: 'Stock in recorded' },
  out: { title: 'Stock out', moveType: 'consume', toastMsg: 'Stock out recorded' },
  transfer: { title: 'Transfer', moveType: 'transfer', toastMsg: 'Transfer recorded' },
};

function MoveModal({ mode, defaultItemId, onClose, onDone }: { mode: MoveMode; defaultItemId: string; onClose: () => void; onDone: () => void }) {
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
      toast.error('Item is required');
      return;
    }
    const qtyNum = parseFloat(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (mode === 'transfer' && !toLocationId) {
      toast.error('Destination location is required');
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
      toast.success(cfg.toastMsg);
      onDone();
    } catch {
      toast.error(`Failed to record ${cfg.title.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={cfg.title} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Item *">
          <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={itemId} onChange={e => setItemId(e.target.value)} autoFocus required>
            <option value="">Select item…</option>
            {sortedItems.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Quantity *">
            <input style={inputStyle} type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} required />
          </Field>
          {mode !== 'transfer' && (
            <Field label="Unit cost">
              <input style={inputStyle} type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
            </Field>
          )}
          {mode === 'transfer' && (
            <Field label="To location *">
              <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={toLocationId} onChange={e => setToLocationId(e.target.value)} required>
                <option value="">Select location…</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Notes">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" style={secondaryBtnStyle} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...primaryBtnStyle, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
            {submitting ? 'Recording…' : cfg.title}
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
      toast.success(`Receipt processed — ${res.data.moves_created.length} moves created`);
      onProcessed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Receipt processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Receive document" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!result && (
          <>
            <Field label="Delivery note / receipt (PDF or image)">
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
                Running OCR + extraction locally… this can take 30–60s.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" style={secondaryBtnStyle} onClick={onClose} disabled={loading}>Cancel</button>
              <button
                type="button"
                style={{ ...primaryBtnStyle, opacity: !file || loading ? 0.6 : 1 }}
                disabled={!file || loading}
                onClick={() => void handleProcess()}
              >
                {loading ? 'Processing…' : 'Process receipt'}
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
              <div><span style={{ color: 'var(--text-dim)' }}>Vendor:</span> {result.vendor ?? '—'}</div>
              <div><span style={{ color: 'var(--text-dim)' }}>Order ref:</span> {result.order_ref ?? '—'}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{result.moves_created.length} moves created</div>
              {result.moves_created.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {result.moves_created.map((m, i) => (
                    <li key={i} style={{ fontSize: '0.75rem' }}>{m.line}</li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: 4, color: result.proposals_queued > 0 ? 'var(--mod-inventory)' : 'var(--text-dim)' }}>
                {result.proposals_queued} proposals queued → Review in Overview
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" style={primaryBtnStyle} onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export function StockTab() {
  const { items, moves, fetchMoves, fetchItems, fetchProposals, reverseMove } = useInventoryStore();
  const [itemFilter, setItemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reversingMove, setReversingMove] = useState<InventoryMove | null>(null);
  const [modal, setModal] = useState<MoveMode | 'receipt' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  const clearSelection = () => {
    setSelected(new Set());
    setConfirmingDelete(false);
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
    setConfirmingDelete(false);
  };

  const allSelected = moves.length > 0 && moves.every(m => selected.has(m.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(moves.map(m => m.id)));
    setConfirmingDelete(false);
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
    const parts = [`${ok} moves reclassified`];
    if (skipped > 0) parts.push(`${skipped} reversals skipped`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (failed > 0) toast.warning(parts.join(' — '));
    else toast.success(parts.join(' — '));
    clearSelection();
    setBulkType('');
  };

  const handleBulkDelete = async () => {
    if (bulkBusy || selected.size === 0) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        await api.delete(`/inventory/moves/${id}`);
        ok++;
      } catch {
        failed++;
      }
    }
    await refreshAfterBulk();
    setBulkBusy(false);
    if (failed > 0) toast.warning(`${ok} moves deleted — ${failed} failed`);
    else toast.success(`${ok} moves deleted`);
    clearSelection();
  };

  const handleUndo = (move: InventoryMove) => setReversingMove(move);

  const confirmUndo = async () => {
    if (!reversingMove) return;
    try {
      await reverseMove(reversingMove.id);
      toast.success('Reversal recorded — the ledger never deletes');
      void load(itemFilter, typeFilter);
    } catch {
      toast.error('Failed to reverse move');
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
          <option value="">All items</option>
          {sortedItems.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        <select style={selectStyle} value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {MOVE_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={secondaryBtnStyle} onClick={() => setModal('in')}>Stock in</button>
          <button style={secondaryBtnStyle} onClick={() => setModal('out')}>Stock out</button>
          <button style={secondaryBtnStyle} onClick={() => setModal('transfer')}>Transfer</button>
          <button style={primaryBtnStyle} onClick={() => setModal('receipt')}>Receive document</button>
        </div>
      </div>

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
            {selected.size} selected
          </span>

          <select style={selectStyle} value={bulkType} onChange={e => setBulkType(e.target.value)} disabled={bulkBusy}>
            <option value="">Change type to…</option>
            {BULK_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            style={{ ...primaryBtnStyle, opacity: !bulkType || bulkBusy ? 0.6 : 1 }}
            disabled={!bulkType || bulkBusy}
            onClick={() => void handleBulkApply()}
          >
            {bulkBusy ? 'Working…' : 'Apply'}
          </button>

          <button
            style={{
              ...secondaryBtnStyle,
              ...(confirmingDelete
                ? { background: '#f43f5e', border: '1px solid #f43f5e', color: '#fff', fontWeight: 600 }
                : { color: '#f43f5e', border: '1px solid rgba(244,63,94,.4)' }),
              opacity: bulkBusy ? 0.6 : 1,
            }}
            disabled={bulkBusy}
            onClick={() => void handleBulkDelete()}
          >
            {confirmingDelete ? `Confirm delete ${selected.size}` : 'Delete'}
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
            Clear
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {moves.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="No stock movements"
            description="Record a stock in, or scan a delivery note to populate the ledger."
            actions={[
              { label: 'Stock in', onClick: () => setModal('in'), variant: 'primary' },
              { label: 'Receive document', onClick: () => setModal('receipt'), variant: 'secondary' },
            ]}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 28 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--amber)', cursor: 'pointer' }}
                  />
                </th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Δ</th>
                <th style={thStyle}>Balance</th>
                <th style={thStyle}>Cost</th>
                <th style={thStyle}>By</th>
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
                      aria-label="Select move"
                      checked={selected.has(move.id)}
                      onChange={() => toggleRow(move.id)}
                      style={{ accentColor: 'var(--amber)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(move.occurred_at).toLocaleDateString()}</td>
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
                        <Undo2 size={12} /> Undo
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
        Corrections are counter-entries — the ledger never deletes. Editing an item's quantity by hand records a silent adjustment.
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
        title="Reverse stock move"
        description="A counter-entry will be recorded. The ledger never deletes — this adds a reversing move that cancels it out."
        confirmLabel="Reverse"
        cancelLabel="Cancel"
        variant="warning"
      />
    </div>
  );
}
