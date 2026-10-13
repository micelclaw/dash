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
import { Banknote } from 'lucide-react';
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
import { RegistrarPagoDialog } from './RegistrarPagoDialog';
import { fmtMoney } from '../lib/format';

// ─── Helpers locales (fmtMoney = SSOT en ../lib/format) ─────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{m.label}</span>;
}

// Facturas cobrables: emitidas con saldo relevante para la pantalla de pagos.
const PAYABLE: DocStatus[] = ['sent', 'partial', 'overdue', 'paid'];

// ─── Tab ───────────────────────────────────────────────────────────────────

export function FacturacionPagosTab() {
  const { documents, contacts } = useFinanceBillingStore();
  const { openInvoice, openContact } = useFacturacionNav();
  // cobrado real por documento (suma de payments), cargado del detalle.
  const [paidByDoc, setPaidByDoc] = useState<Record<string, number>>({});
  // El detalle COMPLETO de la factura a cobrar (con pagos), para el modal compartido.
  const [payFor, setPayFor] = useState<FinanceDocDetail | null>(null);

  const contactName = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);

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
    cliente: (d) => contactName.get(d.contact_id) ?? '',
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
            Collected <span style={{ ...mono, color: 'var(--mod-finance)', fontWeight: 600 }}>{fmtMoney(totalCollected)}</span>
          </span>
        </span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr>
              <SortableTh label="Nº" col="numero" state={sort} />
              <SortableTh label="Customer" col="customer" state={sort} />
              <SortableTh label="Issued" col="emitida" state={sort} />
              <SortableTh label="Due" col="due" state={sort} />
              <SortableTh label="Total" col="total" state={sort} align="right" />
              <SortableTh label="Collected" col="cobrado" state={sort} align="right" />
              <SortableTh label="Pending" col="pendiente" state={sort} align="right" />
              <SortableTh label="Status" col="estado" state={sort} />
              <th style={{ ...th, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={9}>No invoices issued. Issue one to record payments.</td></tr>
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
                      title="Open the invoice"
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
                    {contactName.get(d.contact_id)
                      ? (
                        <span
                          role="button"
                          tabIndex={0}
                          title="Open the customer record"
                          onClick={() => openContact(d.contact_id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openContact(d.contact_id); } }}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--mod-finance)'; e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {contactName.get(d.contact_id)}
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
                        onClick={async () => {
                          // Carga el detalle COMPLETO (con pagos) para el modal compartido.
                          try {
                            const r = await api.get<{ data: FinanceDocDetail }>(`/finance/documents/${d.id}`);
                            setPayFor(r.data);
                          } catch {
                            toast.error('Couldn\'t load the invoice');
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <Banknote size={13} /> Registrar cobro
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Paid</span>
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
          open
          document={payFor}
          onClose={() => {
            // El modal compartido refresca el store al cobrar; invalidamos el cobrado
            // cacheado de esta factura para que su "cobrado/pendiente" se recalcule.
            const id = payFor.id;
            setPaidByDoc((prev) => { const next = { ...prev }; delete next[id]; return next; });
            setPayFor(null);
          }}
        />
      )}
    </div>
  );
}

