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

// P-Pagos (mockup F7) — Cobros de facturación. No hay endpoint global de pagos,
// así que la lista se deriva de las facturas con saldo relevante (emitidas: sent /
// partial / overdue / paid): por cada una se carga el detalle para sumar sus pagos
// reales (cobrado) y calcular el pendiente. Acción "Registrar cobro" → recordPayment.
// Molde = MovimientosTab.tsx (tabla con tokens reales) + NuevoMovimientoDialog (modal).

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X, Banknote } from 'lucide-react';
import { api } from '@/services/api';
import {
  useFinanceBillingStore,
  type FinanceDoc,
  type FinanceDocDetail,
  type DocStatus,
} from '@/stores/finance-billing.store';
import { STATUS_META, tintedPillStyle } from './statusMeta';
import { useSortable, SortableTh } from '@/modules/finance/sortable';
import { useFacturacionNav } from './navigation';

// ─── Helpers locales ───────────────────────────────────────────────────────

function fmtMoney(value: string | number | null | undefined, currency = 'EUR'): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: DocStatus }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{m.label}</span>;
}

// Facturas cobrables: emitidas con saldo relevante para la pantalla de pagos.
const PAYABLE: DocStatus[] = ['sent', 'partial', 'overdue', 'paid'];

// ─── Tab ───────────────────────────────────────────────────────────────────

export function FacturacionPagosTab() {
  const { documents, parties, fetchDocument } = useFinanceBillingStore();
  const { openInvoice, openParty } = useFacturacionNav();
  // cobrado real por documento (suma de payments), cargado del detalle.
  const [paidByDoc, setPaidByDoc] = useState<Record<string, number>>({});
  const [payFor, setPayFor] = useState<FinanceDoc | null>(null);

  const partyName = useMemo(() => new Map(parties.map((p) => [p.id, p.name])), [parties]);

  const invoices = useMemo(
    () =>
      documents
        .filter((d) => d.type === 'invoice' && PAYABLE.includes(d.status))
        .sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1)),
    [documents],
  );

  // Carga el detalle de cada factura cobrable (no pagada del todo) para sumar sus
  // pagos reales. Las pagadas se asumen cobradas al 100% (cobrado = total).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = invoices.filter((d) => d.status !== 'paid' && paidByDoc[d.id] === undefined);
      for (const d of pending) {
        try {
          const r = await api.get<{ data: FinanceDocDetail }>(`/finance/documents/${d.id}`);
          if (cancelled) return;
          const sum = r.data.payments.reduce((acc, p) => acc + Number(p.amount), 0);
          setPaidByDoc((prev) => ({ ...prev, [d.id]: sum }));
        } catch {
          if (cancelled) return;
          setPaidByDoc((prev) => ({ ...prev, [d.id]: 0 }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const collectedOf = (d: FinanceDoc): number =>
    d.status === 'paid' ? Number(d.total) : (paidByDoc[d.id] ?? 0);
  const pendingOf = (d: FinanceDoc): number => Math.max(0, Number(d.total) - collectedOf(d));

  const totalPending = invoices.reduce((acc, d) => acc + pendingOf(d), 0);
  const totalCollected = invoices.reduce((acc, d) => acc + collectedOf(d), 0);

  // Orden por columna (cobrado/pendiente se recalculan al interactuar tras cargar pagos).
  const sort = useSortable(invoices, {
    numero: (d) => d.number ?? '',
    cliente: (d) => partyName.get(d.party_id) ?? '',
    emitida: (d) => d.issue_date,
    vence: (d) => d.due_date ?? null,
    total: (d) => Number(d.total),
    cobrado: (d) => collectedOf(d),
    pendiente: (d) => pendingOf(d),
    estado: (d) => STATUS_META[d.status]?.label ?? d.status,
  });

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' };
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {invoices.length} factura{invoices.length === 1 ? '' : 's'} emitida{invoices.length === 1 ? '' : 's'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ color: 'var(--text-dim)' }}>
            Pendiente <span style={{ ...mono, color: 'var(--info)', fontWeight: 600 }}>{fmtMoney(totalPending)}</span>
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            Cobrado <span style={{ ...mono, color: 'var(--mod-finance)', fontWeight: 600 }}>{fmtMoney(totalCollected)}</span>
          </span>
        </span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortableTh label="Nº" col="numero" state={sort} />
              <SortableTh label="Cliente" col="cliente" state={sort} />
              <SortableTh label="Emitida" col="emitida" state={sort} />
              <SortableTh label="Vence" col="vence" state={sort} />
              <SortableTh label="Total" col="total" state={sort} align="right" />
              <SortableTh label="Cobrado" col="cobrado" state={sort} align="right" />
              <SortableTh label="Pendiente" col="pendiente" state={sort} align="right" />
              <SortableTh label="Estado" col="estado" state={sort} />
              <th style={{ ...th, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={9}>Sin facturas emitidas. Emite una factura para registrar cobros.</td></tr>
            )}
            {sort.sorted.map((d) => {
              const collected = collectedOf(d);
              const pending = pendingOf(d);
              return (
                <tr key={d.id}>
                  <td style={{ ...td, ...mono, whiteSpace: 'nowrap' }}>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Abrir la factura"
                      onClick={() => openInvoice(d.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInvoice(d.id); } }}
                      style={{ color: 'var(--mod-finance)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {d.number ?? '—'}
                    </span>
                  </td>
                  <td style={td}>
                    {partyName.get(d.party_id)
                      ? (
                        <span
                          role="button"
                          tabIndex={0}
                          title="Ver ficha del cliente"
                          onClick={() => openParty(d.party_id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openParty(d.party_id); } }}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--mod-finance)'; e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {partyName.get(d.party_id)}
                        </span>
                      )
                      : '—'}
                  </td>
                  <td style={{ ...td, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{d.issue_date}</td>
                  <td style={{ ...td, color: d.status === 'overdue' ? 'var(--error)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>{d.due_date ?? '—'}</td>
                  <td style={{ ...td, ...mono, textAlign: 'right' }}>{fmtMoney(d.total, d.currency)}</td>
                  <td style={{ ...td, ...mono, textAlign: 'right', color: collected > 0 ? 'var(--mod-finance)' : 'var(--text-muted)' }}>{fmtMoney(collected, d.currency)}</td>
                  <td style={{ ...td, ...mono, textAlign: 'right', color: pending > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{fmtMoney(pending, d.currency)}</td>
                  <td style={td}><StatusBadge status={d.status} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {pending > 0 ? (
                      <button
                        onClick={() => setPayFor(d)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <Banknote size={13} /> Registrar cobro
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cobrada</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payFor && (
        <RegistrarPagoDialog
          doc={payFor}
          pending={pendingOf(payFor)}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            // invalida el cobrado cacheado para esta factura y refresca su detalle
            setPaidByDoc((prev) => {
              const next = { ...prev };
              delete next[payFor.id];
              return next;
            });
            void fetchDocument(payFor.id);
            setPayFor(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal Registrar cobro ─────────────────────────────────────────────────

interface PayAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
}

function RegistrarPagoDialog({
  doc,
  pending,
  onClose,
  onSaved,
}: {
  doc: FinanceDoc;
  pending: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { recordPayment, parties } = useFinanceBillingStore();
  const [accounts, setAccounts] = useState<PayAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState(pending > 0 ? pending.toFixed(2) : '');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const partyName = parties.find((p) => p.id === doc.party_id)?.name ?? '—';

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<{ data: PayAccount[] }>('/finance/accounts');
        const cash = r.data.filter((a) => a.type === 'asset');
        setAccounts(cash);
        if (cash[0]) setAccountId(cash[0].id);
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  const submit = async () => {
    const amt = amount.replace(',', '.').trim();
    if (!amt || Number(amt) <= 0) { toast.error('Indica un importe'); return; }
    if (!accountId) { toast.error('Elige la cuenta del cobro'); return; }
    setSaving(true);
    try {
      await recordPayment({
        document_id: doc.id,
        amount: Number(amt).toFixed(2),
        account_id: accountId,
        date,
        method: method || undefined,
        reference: reference || undefined,
      });
      toast.success('Cobro registrado');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el cobro');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Registrar cobro</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Factura <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{doc.number ?? '—'}</span> · {partyName} · pendiente{' '}
          <span style={{ color: 'var(--info)', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(pending, doc.currency)}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Importe</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00 €"
              style={{ ...fieldStyle, fontSize: 22, fontFamily: 'var(--font-mono, monospace)', textAlign: 'center' }} />
          </div>
          <div>
            <label style={labelStyle}>Cuenta del cobro</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={fieldStyle}>
              <option value="">— elige cuenta —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Método</label>
              <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="p.ej. Transferencia" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Referencia</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="opcional" style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 16px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Guardando…' : 'Registrar cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}
