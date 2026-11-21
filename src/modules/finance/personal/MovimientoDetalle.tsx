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

// Detalle de un movimiento (diálogo). Lenguaje llano (D13): tipo, importe firmado,
// cuenta(s), categoría, fecha, recurrencia. Acción: revertir (crea el contra-asiento).

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import { X, ArrowRight, Undo2, Pencil } from 'lucide-react';
import { useFinancePersonalStore, type FinanceTransaction } from '@/stores/finance-personal.store';
import { fmtMoney, movementFace, categoryVisual, tintBackground } from './lib';
import { RecurrenceBadge } from './RecurrenceBadge';
import { RelationIntelligence } from '@/components/shared/RelationIntelligence';
import { MovimientoRelatedPanel } from './MovimientoRelatedPanel';
import { NuevoMovimientoDialog } from './NuevoMovimientoDialog';
import { useEscapeClose } from '../use-escape-close';

const SOURCE_KEYS: Record<string, string> = {
  manual: 'finance.movement.source.manual',
  document: 'finance.movement.source.document',
  payment: 'finance.movement.source.payment',
  reversal: 'finance.movement.source.reversal',
  closing: 'finance.movement.source.closing',
  opening: 'finance.movement.source.opening',
};
const SOURCE_GLYPHS: Record<string, string> = {
  manual: '📝', document: '🧾', payment: '💸', reversal: '↩️', closing: '🔒', opening: '📂',
};

export function MovimientoDetalle({ tx, onClose }: { tx: FinanceTransaction | null; onClose: () => void }) {
  const { t } = useI18n();
  const { accounts, categories, reverseTransaction } = useFinancePersonalStore();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  useEscapeClose(!!tx && !editing, onClose);

  if (!tx) return null;

  const f = movementFace(tx, accounts);
  const cat = f.categoryId ? categories.find((c) => c.id === f.categoryId) : undefined;
  const cv = !f.isTransfer && cat ? categoryVisual(cat) : null;
  const recurring = !!tx.recurring_rule_id;

  const reverse = async () => {
    if (!window.confirm(t('finance.movement.reverseConfirm'))) return;
    setBusy(true);
    try {
      await reverseTransaction(tx.id);
      toast.success(t('finance.movement.reversed'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('finance.movement.reverseFailed'));
    } finally { setBusy(false); }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tx.description || t(`finance.movement.kind.${f.isTransfer ? 'transfer' : f.signed >= 0 ? 'income' : 'expense'}`)}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tx.date}</span>
              {(() => {
                const sm = {
                  label: t(recurring ? 'finance.movement.source.recurring' : SOURCE_KEYS[tx.source] ?? 'finance.movement.source.system'),
                  glyph: recurring ? '🔁' : SOURCE_GLYPHS[tx.source] ?? '⚙️',
                };
                return (
                  <span title={t('finance.movement.sourceHelp')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-dim)' }}>
                    <span style={{ fontSize: 11, lineHeight: 1 }}>{sm.glyph}</span>{sm.label}
                  </span>
                );
              })()}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('finance.movement.detail.close')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* Importe destacado */}
        <div style={{ textAlign: 'center', padding: '10px 0 14px' }}>
          <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: f.isTransfer ? 'var(--text)' : f.signed >= 0 ? 'var(--mod-finance)' : 'var(--error)' }}>
            {!f.isTransfer && (f.signed >= 0 ? '+' : '−')}{fmtMoney(Math.abs(f.signed))}
          </span>
        </div>

        <div>
          {row(t('finance.movement.detail.description'), tx.description
            ? <span style={{ color: 'var(--text)' }}>{tx.description}</span>
            : <span style={{ color: 'var(--text-muted)' }}>(sin concepto)</span>)}
          {row(t('finance.movement.detail.type'), <span>{f.glyph} {t(`finance.movement.kind.${f.isTransfer ? 'transfer' : f.signed >= 0 ? 'income' : 'expense'}`)}</span>)}
          {f.isTransfer && f.transferFrom && f.transferTo ? (
            row(t('finance.movement.detail.accounts'), (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {f.transferFrom}<ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />{f.transferTo}
              </span>
            ))
          ) : (
            row(t('finance.movement.detail.account'), f.accountName)
          )}
          {!f.isTransfer && row(t('finance.movement.detail.category'), cv ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px 2px 7px', background: tintBackground(cv.color), borderRadius: 'var(--radius-full, 999px)', fontSize: 12 }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{cv.emoji}</span>{cv.name}
            </span>
          ) : <span style={{ color: 'var(--text-muted)' }}>{t('finance.movement.detail.uncategorised')}</span>)}
          {recurring && row(t('finance.movement.detail.recurrence'), <RecurrenceBadge />)}
        </div>

        {/* Relaciones DERIVADAS del ledger: cuenta(s) + factura + contacto (siempre ≥1). */}
        <div style={{ marginTop: 14 }}>
          <MovimientoRelatedPanel entryId={tx.id} onNavigate={onClose} />
        </div>

        {/* Inteligencia de relaciones: Related Entities + Similar Semantic + Graph Proximity */}
        <div style={{ marginTop: 14 }}>
          <RelationIntelligence sourceType="finance_journal_entry" sourceId={tx.id} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reverse} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--error)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Undo2 size={14} /> {t('finance.movement.detail.reverse')}
            </button>
            <button onClick={() => setEditing(true)} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Pencil size={14} /> {t('finance.movement.detail.edit')}
            </button>
          </div>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('finance.movement.detail.close')}</button>
        </div>
      </div>

      {/* Editar: reabre el formulario prerrellenado; al guardar, concepto/categoría in situ
          o importe/cuenta/fecha vía reversar+recrear (lo decide editMovement en el store). */}
      <NuevoMovimientoDialog open={editing} editTx={tx} onClose={() => { setEditing(false); onClose(); }} />
    </div>
  );
}
