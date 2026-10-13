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

// F4/F5/F6 — Facturas: tabla de documentos (number, cliente, emitida, vence,
// total, estado) + panel de detalle/acciones al clicar una fila (emitir, cobro,
// abono, convertir presupuesto). Botón "+ Invoice" abre el editor.
// Molde = MovimientosTab.tsx de la lente Personal.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus, X, FileText, Loader2, Paperclip, Boxes, ArrowRight } from 'lucide-react';
import {
  useFinanceBillingStore,
  type DocType,
  type DocStatus,
  type FinanceDoc,
  type DocRelated,
} from '@/stores/finance-billing.store';
import { fmtMoney } from '@/modules/finance/personal/lib';
import { STATUS_META, tintedPillStyle, statusLabel } from './statusMeta';
import { useSortable, SortableTh } from '@/modules/finance/sortable';
import { RegistrarPagoDialog } from './RegistrarPagoDialog';
import { useFacturacionNav } from './navigation';
import { useEscapeClose } from '../use-escape-close';

// ─── Etiqueta de tipo de documento ───────────────────────────────────────
const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: 'Invoice',
  quote: 'Quote',
  bill: 'Factura recibida',
  receipt: 'Recibo',
  credit_note: 'Credit note',
};

function StatusBadge({ status, docType }: { status: DocStatus; docType?: DocType }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{statusLabel(status, docType)}</span>;
}

// Las facturas RECIBIDAS (bill) tienen su propia pestaña "Received" (lockedType);
// no se ofrecen aquí para no duplicar la puerta de acceso (la pestaña Facturas es
// el lado VENTAS: factura/presupuesto/recibo/abono).
// Sin 'quote' ni 'bill': los presupuestos tienen su pestaña "Quotes" y las
// facturas recibidas la suya "Received". Aquí solo documentos de VENTA emitidos.
const TYPE_FILTERS: { id: '' | DocType; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'receipt', label: 'Recibos' },
  { id: 'credit_note', label: 'Credit notes' },
];

const STATUS_FILTERS: { id: '' | DocStatus; label: string }[] = [
  { id: '', label: 'Any status' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Rejected' },
  { id: 'partial', label: 'Partial payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'cancelled', label: 'Voided' },
  { id: 'converted', label: 'Converted' },
];

export function FacturacionFacturasTab({ lockedType }: { lockedType?: DocType } = {}) {
  const {
    documents,
    contacts,
    fetchDocuments,
    convertQuote,
    createCreditNote,
  } = useFinanceBillingStore();
  const { openInvoice, openNewQuote, openNewBill, openContact } = useFacturacionNav();

  // Cuando `lockedType` viene (p. ej. vista de Presupuestos), el filtro de tipo
  // queda fijado a ese valor y su <select> se oculta; el resto de filtros y la
  // tabla son idénticos. Sin `lockedType`, comportamiento exacto de siempre.
  const [type, setType] = useState<'' | DocType>(lockedType ?? '');
  const [status, setStatus] = useState<'' | DocStatus>('');
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  // Mantén el filtro sincronizado si la prop cambia (p. ej. al reusar el
  // componente para otra vista sin desmontarlo).
  useEffect(() => {
    if (lockedType) setType(lockedType);
  }, [lockedType]);

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  // Filtrado 100% CLIENTE-SIDE desde el array COMPLETO del store (que carga TODOS los
  // documentos). Antes se re-consultaba el backend por tipo/estado, lo que MACHACABA el
  // array `documents` compartido y dejaba a la pestaña Cobros (y a otras) sin facturas
  // según el orden de navegación. lockedType acota a su tipo; sin él, Facturas excluye
  // las recibidas (bill), que tienen su propia pestaña.
  const visibleDocs = useMemo(() => {
    let list = lockedType
      ? documents.filter((d) => d.type === lockedType)
      : documents.filter((d) => d.type !== 'bill' && d.type !== 'quote');
    if (!lockedType && type) list = list.filter((d) => d.type === type);
    if (status) list = list.filter((d) => d.status === status);
    return list;
  }, [documents, lockedType, type, status]);
  // Orden por columna de la tabla de documentos.
  const sort = useSortable(visibleDocs, {
    number: (d) => d.number ?? '',
    client: (d) => contactById.get(d.contact_id) ?? '',
    issue: (d) => d.issue_date,
    due: (d) => d.due_date ?? null,
    total: (d) => Number(d.total),
    status: (d) => STATUS_META[d.status]?.label ?? d.status,
  });

  // Carga TODOS los documentos al montar (sin filtro de tipo/estado). El filtrado de la
  // tabla es cliente-side (visibleDocs). Así esta pestaña nunca deja el store con un
  // subconjunto que rompa Cobros u otras vistas que comparten el array `documents`.
  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // Abrir en el editor (deep-link de la lente). Cierra antes el panel de detalle.
  const openEdit = (id: string) => {
    setOpenDocId(null);
    openInvoice(id);
  };

  const selStyle: React.CSSProperties = { padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {!lockedType && (
          <select value={type} onChange={(e) => setType(e.target.value as '' | DocType)} style={selStyle}>
            {TYPE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | DocStatus)} style={selStyle}>
          {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{visibleDocs.length} documento{visibleDocs.length === 1 ? '' : 's'}</span>
        {lockedType === 'quote' ? (
          <button onClick={openNewQuote} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Quote
          </button>
        ) : lockedType === 'bill' ? (
          <button onClick={openNewBill} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Factura recibida
          </button>
        ) : (
          <button onClick={() => openInvoice('')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Invoice
          </button>
        )}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <SortableTh label={lockedType === 'bill' ? 'Nº proveedor' : 'Number'} col="number" state={sort} />
              <SortableTh label={lockedType === 'bill' ? 'Supplier' : 'Customer'} col="client" state={sort} />
              <SortableTh label={lockedType === 'bill' ? 'Received' : 'Issued'} col="issue" state={sort} />
              <SortableTh label="Due" col="due" state={sort} />
              <SortableTh label="Total" col="total" state={sort} align="right" />
              <SortableTh label="Status" col="status" state={sort} align="right" />
            </tr>
          </thead>
          <tbody>
            {visibleDocs.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={6}>Sin documentos para este filtro. Crea uno con {lockedType === 'quote' ? '“+ Presupuesto”' : lockedType === 'bill' ? '“+ Factura recibida”' : '“+ Factura”'}.</td></tr>
            )}
            {sort.sorted.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => setOpenDocId(doc.id)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono, monospace)' }}>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Open in the editor"
                    onClick={(e) => { e.stopPropagation(); openEdit(doc.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); openEdit(doc.id); } }}
                    style={{ color: 'var(--mod-finance)', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {doc.number ?? <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>— draft</span>}
                  </span>
                  {doc.external_ref?.attachment && <Paperclip size={12} style={{ marginLeft: 6, verticalAlign: 'middle', color: 'var(--text-muted)' }} />}
                  {doc.type !== 'invoice' && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'inherit' }}>{DOC_TYPE_LABEL[doc.type]}</span>}
                </td>
                <td style={td}>
                  {contactById.get(doc.contact_id)
                    ? (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Open the customer record"
                        onClick={(e) => { e.stopPropagation(); openContact(doc.contact_id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); openContact(doc.contact_id); } }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--mod-finance)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        {contactById.get(doc.contact_id)}
                      </span>
                    )
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ ...td, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{doc.issue_date}</td>
                <td style={{ ...td, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{doc.due_date ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(doc.total, doc.currency)}</td>
                <td style={{ ...td, textAlign: 'right' }}><StatusBadge status={doc.status} docType={doc.type} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openDocId && (
        <DocDetailPanel
          docId={openDocId}
          contactName={contactById.get(documents.find((d) => d.id === openDocId)?.contact_id ?? '') ?? null}
          onClose={() => setOpenDocId(null)}
          onEdit={openEdit}
          onConvert={async (id) => {
            try {
              const inv = await convertQuote(id);
              toast.success('Presupuesto convertido a factura');
              setOpenDocId(null);
              openEdit(inv.id);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Couldn\'t convert');
            }
          }}
          onCreditNote={async (id, total, currency) => {
            const raw = window.prompt('Importe a abonar', total);
            if (!raw) return;
            const amt = raw.replace(',', '.').trim();
            if (!amt || Number(amt) <= 0) { toast.error('Enter an amount'); return; }
            const reason = window.prompt('Motivo del abono (opcional)') ?? undefined;
            try {
              await createCreditNote({ invoice_id: id, amount: Number(amt).toFixed(2), reason: reason || undefined });
              toast.success('Credit note created');
              setOpenDocId(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Couldn\'t create the credit note');
            }
            void currency;
          }}
        />
      )}
    </div>
  );
}

// ─── Panel de detalle + acciones ─────────────────────────────────────────

function DocDetailPanel({
  docId,
  contactName,
  onClose,
  onEdit,
  onConvert,
  onCreditNote,
}: {
  docId: string;
  contactName: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onConvert: (id: string) => void | Promise<void>;
  onCreditNote: (id: string, total: string, currency: string) => void | Promise<void>;
}) {
  const { currentDoc, fetchDocument, fetchDocumentRelated, emitDocument, acceptQuote, declineQuote } = useFinanceBillingStore();
  const navigate = useNavigate();
  const [emitting, setEmitting] = useState(false);
  const [decideBusy, setDecideBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [related, setRelated] = useState<DocRelated | null>(null);

  // Escape cierra el detalle, pero solo si no hay un modal de pago anidado encima
  // (en ese caso Escape lo cierra a él primero).
  useEscapeClose(!payOpen, onClose);

  useEffect(() => {
    void fetchDocument(docId);
    let alive = true;
    void fetchDocumentRelated(docId).then((r) => { if (alive) setRelated(r); }).catch(() => { if (alive) setRelated(null); });
    return () => { alive = false; };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doc = currentDoc && currentDoc.id === docId ? currentDoc : null;

  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)' };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text)' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' };

  const isInvoiceLike = doc?.type === 'invoice' || doc?.type === 'bill';
  const canEmit = doc?.status === 'draft';
  const canPay = !!doc && isInvoiceLike && ['sent', 'partial', 'overdue', 'accepted'].includes(doc.status);
  const canConvert = doc?.type === 'quote' && ['draft', 'sent', 'accepted'].includes(doc?.status ?? '');
  const canAcceptDecline = doc?.type === 'quote' && ['draft', 'sent'].includes(doc?.status ?? '');
  const canCreditNote = (doc?.type === 'invoice' || doc?.type === 'bill') && ['sent', 'partial', 'overdue', 'paid'].includes(doc?.status ?? '');

  const paid = doc ? doc.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const balance = doc ? Number(doc.total) - paid : 0;

  const emit = async () => {
    setEmitting(true);
    try {
      await emitDocument(docId);
      toast.success('Document issued');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t issue');
    } finally {
      setEmitting(false);
    }
  };

  const accept = async () => {
    if (!doc) return;
    setDecideBusy(true);
    try {
      await acceptQuote(doc.id);
      toast.success('Presupuesto aceptado');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t accept the quote');
    } finally {
      setDecideBusy(false);
    }
  };

  const decline = async () => {
    if (!doc) return;
    setDecideBusy(true);
    try {
      await declineQuote(doc.id);
      toast.success('Presupuesto rechazado');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t reject the quote');
    } finally {
      setDecideBusy(false);
    }
  };

  const actionBtn = (bg: string, color: string): React.CSSProperties => ({
    padding: '8px 14px', background: bg, border: bg === 'transparent' ? '1px solid var(--border)' : 'none',
    borderRadius: 'var(--radius-md, 6px)', color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6,
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: '92vw', maxHeight: '84vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: 'var(--mod-finance)' }} />
            {doc?.number ?? 'Draft'}
            {doc && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{DOC_TYPE_LABEL[doc.type]}</span>}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {!doc && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {doc && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={rowStyle}><span style={labelStyle}>{doc.type === 'bill' ? 'Supplier' : 'Customer'}</span><span style={valueStyle}>{contactName ?? '—'}</span></div>
              <div style={rowStyle}><span style={labelStyle}>Status</span><StatusBadge status={doc.status} docType={doc.type} /></div>
              <div style={rowStyle}><span style={labelStyle}>{doc.type === 'bill' ? 'Recibida' : 'Emitida'}</span><span style={valueStyle}>{doc.issue_date}</span></div>
              <div style={rowStyle}><span style={labelStyle}>Due</span><span style={valueStyle}>{doc.due_date ?? '—'}</span></div>
            </div>

            {/* Líneas */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No lines.</td></tr>
                  )}
                  {doc.lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ padding: '6px 10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{l.description}</td>
                      <td style={{ padding: '6px 10px', fontSize: 13, color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', borderBottom: '1px solid var(--border)' }}>{Number(l.quantity)}</td>
                      <td style={{ padding: '6px 10px', fontSize: 13, color: 'var(--text)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', borderBottom: '1px solid var(--border)' }}>{fmtMoney(l.line_total, doc.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div style={{ marginBottom: 14, fontFamily: 'var(--font-mono, monospace)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: 'var(--text-dim)' }}><span>Base</span><span>{fmtMoney(doc.subtotal, doc.currency)}</span></div>
              {Number(doc.discount_value ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: 'var(--text-dim)' }}><span>Discount</span><span>{doc.discount_kind === 'percent' ? `${Number(doc.discount_value)}%` : `−${fmtMoney(doc.discount_value, doc.currency)}`}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: 'var(--text-dim)' }}><span>IVA</span><span>{fmtMoney(doc.tax_total, doc.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)', marginTop: 4 }}><span>TOTAL</span><span>{fmtMoney(doc.total, doc.currency)}</span></div>
              {paid > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: 'var(--mod-finance)' }}><span>{doc.type === 'bill' ? 'Paid' : 'Collected'}</span><span>{fmtMoney(paid, doc.currency)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: balance > 0 ? 'var(--info)' : 'var(--text-dim)' }}><span>Pending</span><span>{fmtMoney(balance, doc.currency)}</span></div>
                </>
              )}
            </div>

            {/* Pagos registrados */}
            {doc.payments.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{doc.type === 'bill' ? 'Payments' : 'Payments in'}</div>
                {doc.payments.map((p) => {
                  // Enlace al dinero: la cuenta donde ENTRÓ el cobro / de donde SALIÓ el pago.
                  const acct = related?.payments.find((rp) => rp.id === p.id)?.account_name;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', padding: '3px 0' }}>
                      <span>{p.date}{acct ? ` · ${doc.type === 'bill' ? 'desde' : 'a'} ${acct}` : ''}{p.method ? ` · ${p.method}` : ''}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: doc.type === 'bill' ? 'var(--error)' : 'var(--mod-finance)' }}>{doc.type === 'bill' ? '−' : '+'}{fmtMoney(p.amount, doc.currency)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Relacionado · inventario (cruce de dominios): la factura recibida REPUSO
                estos artículos / la factura emitida los VENDIÓ. Clic → módulo Inventario. */}
            {related && related.inventory.length > 0 && (
              <div style={{ marginBottom: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8 }}>
                  <Boxes size={14} style={{ color: 'var(--mod-inventory)' }} />
                  {related.inventory[0]?.relation === 'purchased' ? 'Repuso en inventario' : 'Vendido del inventario'}
                </div>
                {related.inventory.map((it) => (
                  <div key={it.item_id} role="button" tabIndex={0}
                    title="Open in Inventory"
                    onClick={() => navigate(`/inventory?id=${it.item_id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/inventory?id=${it.item_id}`); } }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', margin: '0 -6px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <ArrowRight size={13} style={{ color: 'var(--mod-inventory)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    </span>
                    <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono, monospace)', color: it.relation === 'purchased' ? 'var(--mod-finance)' : 'var(--error)' }}>
                      {it.relation === 'purchased' ? '+' : '−'}{it.quantity}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Click to open the item in Inventory.</div>
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              {doc.status === 'draft' && (
                <button onClick={() => onEdit(doc.id)} style={actionBtn('transparent', 'var(--text-dim)')}>Edit</button>
              )}
              {canAcceptDecline && (
                <>
                  <button onClick={accept} disabled={decideBusy} style={actionBtn('var(--mod-finance)', '#0a0a0a')}>OK</button>
                  <button onClick={decline} disabled={decideBusy} style={actionBtn('transparent', 'var(--error)')}>Reject</button>
                </>
              )}
              {canConvert && (
                <button onClick={() => onConvert(doc.id)} style={actionBtn('transparent', 'var(--text-dim)')}>Convert to invoice</button>
              )}
              {canCreditNote && (
                <button onClick={() => onCreditNote(doc.id, doc.total, doc.currency)} style={actionBtn('transparent', 'var(--text-dim)')}>{doc.type === 'bill' ? 'Registrar abono recibido' : 'Create credit note'}</button>
              )}
              {canPay && (
                <button onClick={() => setPayOpen(true)} style={actionBtn('var(--info)', '#0a0a0a')}>{doc.type === 'bill' ? 'Registrar pago' : 'Registrar cobro'}</button>
              )}
              {canEmit && (
                <button onClick={emit} disabled={emitting} style={actionBtn(doc.type === 'bill' ? 'var(--mod-finance)' : 'var(--amber)', '#0a0a0a')}>
                  {emitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  {emitting ? (doc.type === 'bill' ? 'Registrando…' : 'Emitiendo…') : (doc.type === 'bill' ? 'Registrar' : 'Issue')}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {doc && <RegistrarPagoDialog open={payOpen} onClose={() => setPayOpen(false)} document={doc} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Tipo re-exportado para conveniencia de consumidores externos.
export type { FinanceDoc };
