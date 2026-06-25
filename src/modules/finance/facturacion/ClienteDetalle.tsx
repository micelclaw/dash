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

// A5 — Ficha de cliente RICA. Muestra (con color) todos los datos del party:
// nombre, razón social, CIF/NIF, divisa, condiciones de pago, direcciones de
// facturación, contactos vinculados (del detalle), notas, tags, y un editor de
// DATOS EXTRA (custom_fields) clave/valor. Además resume SUS FACTURAS (fetch
// GET /finance/documents?party_id=<id>: facturado/cobrado/pendiente + lista
// clicable que abre cada factura en el editor). Editable: guarda vía
// updateParty (PATCH /finance/parties/:id) con TODOS los campos incl.
// custom_fields. Reusa STATUS_META para los estados y fmtMoney local.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api } from '@/services/api';
import {
  Pencil, FileText, Users, MapPin, StickyNote, Tag, Database, Wallet,
  Plus, Trash2, Save, XCircle, Loader2,
} from 'lucide-react';
import {
  useFinanceBillingStore,
  type Party,
  type PartyDetail,
  type PartyContact,
  type BillingAddress,
  type CustomFields,
  type FinanceDoc,
  type DocStatus,
  type DocType,
} from '@/stores/finance-billing.store';
import { STATUS_META, tintedPillStyle, statusLabel } from './statusMeta';

const KIND_LABEL: Record<Party['kind'], string> = {
  customer: 'Cliente',
  supplier: 'Proveedor',
  employee: 'Empleado',
  self: 'Propio',
};

const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: 'Factura',
  quote: 'Presupuesto',
  bill: 'Factura recibida',
  receipt: 'Recibo',
  credit_note: 'Abono',
};

const CURRENCIES = ['EUR', 'USD', 'GBP'];

function fmtMoney(value: string | number | null | undefined, currency = 'EUR'): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function StatusBadge({ status, docType }: { status: DocStatus; docType?: DocType }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{statusLabel(status, docType)}</span>;
}

// custom_fields como filas editables (orden estable).
interface KvRow { key: string; value: string }

function recordToRows(cf: CustomFields | null | undefined): KvRow[] {
  if (!cf || typeof cf !== 'object') return [];
  return Object.entries(cf).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

function rowsToRecord(rows: KvRow[]): CustomFields {
  const out: CustomFields = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    // Intenta tipar el valor (number/bool/json); si no, string crudo.
    const raw = r.value;
    const trimmed = raw.trim();
    let parsed: unknown = raw;
    if (trimmed === 'true') parsed = true;
    else if (trimmed === 'false') parsed = false;
    else if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) parsed = Number(trimmed);
    else if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { parsed = JSON.parse(trimmed); } catch { parsed = raw; }
    }
    out[k] = parsed;
  }
  return out;
}

function fmtAddress(a: BillingAddress): string {
  return [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country]
    .filter(Boolean)
    .join(', ');
}

export function ClienteDetalle({
  partyId,
  onOpenInvoice,
}: {
  partyId: string;
  onOpenInvoice: (docId: string) => void;
}) {
  const navigate = useNavigate();
  const { parties, fetchPartyDetail, updateParty } = useFinanceBillingStore();
  const partyFromList = parties.find((p) => p.id === partyId) ?? null;

  const [detail, setDetail] = useState<PartyDetail | null>(null);
  const [docs, setDocs] = useState<FinanceDoc[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos editables.
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [addresses, setAddresses] = useState<BillingAddress[]>([]);
  const [kvRows, setKvRows] = useState<KvRow[]>([]);

  const hydrate = useCallback((p: Party | PartyDetail) => {
    setName(p.name ?? '');
    setLegalName(p.legal_name ?? '');
    setTaxId(p.tax_id ?? '');
    setCurrency(p.default_currency || 'EUR');
    setPaymentTerms(p.payment_terms != null ? String(p.payment_terms) : '');
    setNotes(p.notes ?? '');
    setTags((p.tags ?? []).join(', '));
    setAddresses(Array.isArray(p.billing_addresses) ? p.billing_addresses : []);
    setKvRows(recordToRows(p.custom_fields));
  }, []);

  // Detalle (contactos + custom_fields completos) al cambiar de cliente.
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setEditing(false);
    fetchPartyDetail(partyId)
      .then((d) => { if (alive) { setDetail(d); hydrate(d); } })
      .catch(() => { if (alive && partyFromList) { hydrate(partyFromList); } });
    return () => { alive = false; };
  }, [partyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Facturas del cliente (resumen + lista clicable).
  useEffect(() => {
    let alive = true;
    setDocs(null);
    api.get<{ data: FinanceDoc[] }>('/finance/documents', { party_id: partyId } as Record<string, string>)
      .then((r) => { if (alive) setDocs(r.data); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [partyId]);

  const party = detail ?? partyFromList;
  const contacts: PartyContact[] = detail?.contacts ?? [];
  const isSupplier = party?.kind === 'supplier';

  // Totales sobre los documentos del party.
  // Cliente → facturas emitidas (invoice). Proveedor → facturas recibidas (bill).
  const summary = useMemo(() => {
    const list = docs ?? [];
    const docType: DocType = isSupplier ? 'bill' : 'invoice';
    const rows = list.filter((d) => d.type === docType && d.status !== 'draft');
    const facturado = rows.reduce((s, d) => s + Number(d.total), 0);
    const cobrado = rows.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.total), 0);
    const pendiente = rows
      .filter((d) => ['sent', 'partial', 'overdue'].includes(d.status))
      .reduce((s, d) => s + Number(d.total), 0);
    return { facturado, cobrado, pendiente, count: list.length };
  }, [docs, isSupplier]);

  const startEdit = () => { if (party) hydrate(party); setEditing(true); };
  const cancelEdit = () => { if (party) hydrate(party); setEditing(false); };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('El nombre no puede estar vacío'); return; }
    const pt = paymentTerms.trim();
    if (pt && (Number.isNaN(Number(pt)) || Number(pt) < 0)) { toast.error('Condiciones de pago: indica un número de días válido'); return; }
    setSaving(true);
    try {
      const cleanAddresses = addresses.filter((a) => Object.values(a).some((v) => (v ?? '').toString().trim() !== ''));
      const updated = await updateParty(partyId, {
        kind: party?.kind ?? 'customer',
        name: trimmed,
        legal_name: legalName.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        default_currency: currency,
        payment_terms: pt ? Number(pt) : null,
        notes: notes.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        billing_addresses: cleanAddresses,
        custom_fields: rowsToRecord(kvRows),
      });
      // Refresca el detalle para reflejar contactos/saldo y normalización del backend.
      const fresh = await fetchPartyDetail(partyId).catch(() => null);
      setDetail(fresh ?? { ...(detail ?? (updated as PartyDetail)), ...updated, contacts });
      setEditing(false);
      toast.success('Cliente actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!party) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in srgb, var(--mod-finance) 18%, transparent)',
              color: 'var(--mod-finance)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 700,
            }}>{(party.name || '?').charAt(0).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>{party.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {KIND_LABEL[party.kind]}{party.legal_name ? ` · ${party.legal_name}` : ''}
              </div>
            </div>
          </div>
        </div>
        {!editing ? (
          <button onClick={startEdit} style={btnGhost}>
            <Pencil size={13} /> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelEdit} disabled={saving} style={btnGhost}><XCircle size={13} /> Cancelar</button>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />} Guardar
            </button>
          </div>
        )}
      </div>

      {/* Resumen de documentos (KPIs con color). Cliente=ventas / Proveedor=compras */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {isSupplier ? (
          <>
            <Kpi label="Gastado" value={fmtMoney(summary.facturado, party.default_currency)} accent="var(--error)" />
            <Kpi label="Pagado" value={fmtMoney(summary.cobrado, party.default_currency)} accent="var(--warning)" />
            <Kpi label="Por pagar" value={fmtMoney(summary.pendiente, party.default_currency)} accent="var(--amber)" muted={summary.pendiente <= 0} />
          </>
        ) : (
          <>
            <Kpi label="Facturado" value={fmtMoney(summary.facturado, party.default_currency)} accent="var(--amber)" />
            <Kpi label="Cobrado" value={fmtMoney(summary.cobrado, party.default_currency)} accent="var(--mod-finance)" />
            <Kpi label="Pendiente" value={fmtMoney(summary.pendiente, party.default_currency)} accent="var(--info)" muted={summary.pendiente <= 0} />
          </>
        )}
        <Kpi
          label="Saldo a favor"
          value={fmtMoney(party.credit_balance, party.default_currency)}
          accent="var(--mod-finance)"
          muted={Number(party.credit_balance) <= 0}
        />
      </div>

      {/* Datos fiscales / de pago */}
      <Section icon={<Wallet size={14} />} title="Datos">
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
            <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
            <Field label="Razón social"><input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Nombre legal completo" style={inputStyle} /></Field>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Field label="CIF / NIF" style={{ flex: '1 1 160px' }}>
                <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="B12345678" style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }} />
              </Field>
              <Field label="Moneda" style={{ width: 110 }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Vencimiento (días)" style={{ width: 150 }}>
                <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} inputMode="numeric" placeholder="p.ej. 30" style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }} />
              </Field>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 10 }}>
            <InfoCard label="CIF / NIF" value={party.tax_id || '—'} mono />
            <InfoCard label="Moneda" value={party.default_currency} mono />
            <InfoCard label="Condiciones de pago" value={party.payment_terms != null ? `${party.payment_terms} días` : '—'} />
          </div>
        )}
      </Section>

      {/* Direcciones de facturación */}
      <Section icon={<MapPin size={14} />} title="Direcciones de facturación">
        {editing ? (
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {addresses.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 10, position: 'relative' }}>
                <button onClick={() => setAddresses(addresses.filter((_, j) => j !== i))} title="Quitar"
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['label', 'line1', 'line2', 'postal_code', 'city', 'region', 'country'] as (keyof BillingAddress)[]).map((f) => (
                    <input
                      key={f}
                      value={(a[f] as string) ?? ''}
                      onChange={(e) => setAddresses(addresses.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x))}
                      placeholder={ADDR_PLACEHOLDER[f]}
                      style={{ ...inputStyle, flex: f === 'line1' ? '1 1 100%' : '1 1 140px' }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setAddresses([...addresses, {}])} style={btnDashed}>
              <Plus size={14} /> Añadir dirección
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 6 }}>
            {(party.billing_addresses ?? []).length === 0 && <div style={emptyStyle}>Sin direcciones.</div>}
            {(party.billing_addresses ?? []).map((a, i) => (
              <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                {a.label && <span style={{ color: 'var(--text-dim)', fontWeight: 600, marginRight: 8 }}>{a.label}</span>}
                <span style={{ color: 'var(--text)' }}>{fmtAddress(a) || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Contactos vinculados (del CRM) — clicables, navegan a /contacts?id= */}
      <Section icon={<Users size={14} />} title={`Contactos (${contacts.length})`}>
        <div style={{ paddingTop: 6 }}>
          {contacts.length === 0 ? (
            <div style={emptyStyle}>
              Este cliente aún no tiene ningún contacto del CRM enlazado. Lo ideal es que cada
              cliente parta de un contacto de tu CRM (al crearlo desde «Usar un contacto del CRM»)
              para no duplicar datos entre dominios.
            </div>
          ) : (
            contacts.map((c) => {
              const isPrimary = !!party.primary_contact_id && c.contact_id === party.primary_contact_id;
              const email = Array.isArray(c.contact_email) ? c.contact_email.find(Boolean) ?? null : null;
              return (
                <div
                  key={c.contact_id}
                  role="button"
                  tabIndex={0}
                  title="Ver el contacto en el CRM"
                  onClick={() => navigate(`/contacts?id=${c.contact_id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/contacts?id=${c.contact_id}`); } }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    padding: '8px 6px', borderBottom: '1px solid var(--border)', fontSize: 13,
                    cursor: 'pointer', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Users size={14} style={{ color: 'var(--mod-finance)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.contact_name || c.contact_id}
                    </span>
                    {isPrimary && <span style={tintedPillStyle('var(--mod-finance)')}>principal</span>}
                  </span>
                  <span style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                    {email && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{email}</span>}
                    {c.role && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</span>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Section>

      {/* Notas + Tags */}
      <Section icon={<StickyNote size={14} />} title="Notas">
        {editing ? (
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas sobre el cliente…" style={{ ...inputStyle, resize: 'vertical' }} />
            <Field label="Etiquetas (separadas por coma)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, recurrente, moroso" style={inputStyle} />
            </Field>
          </div>
        ) : (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 13, color: party.notes ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: (party.tags ?? []).length ? 10 : 0 }}>
              {party.notes || 'Sin notas.'}
            </div>
            {(party.tags ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                {(party.tags ?? []).map((t) => (
                  <span key={t} style={tintedPillStyle('var(--mod-finance)')}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Datos extra (custom_fields) */}
      <Section icon={<Database size={14} />} title="Datos extra">
        {editing ? (
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kvRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={row.key} onChange={(e) => setKvRows(kvRows.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} placeholder="clave" style={{ ...inputStyle, flex: '0 0 38%', fontFamily: 'var(--font-mono, monospace)' }} />
                <input value={row.value} onChange={(e) => setKvRows(kvRows.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} placeholder="valor" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => setKvRows(kvRows.filter((_, j) => j !== i))} title="Quitar" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => setKvRows([...kvRows, { key: '', value: '' }])} style={btnDashed}>
              <Plus size={14} /> Añadir campo
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 6 }}>
            {recordToRows(party.custom_fields).length === 0 && <div style={emptyStyle}>Sin datos extra.</div>}
            {recordToRows(party.custom_fields).map((row) => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{row.key}</span>
                <span style={{ color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Facturas del cliente — lista clicable */}
      <Section icon={<FileText size={14} />} title={`Facturas (${docs?.length ?? 0})`}>
        <div style={{ paddingTop: 6 }}>
          {docs === null && <div style={emptyStyle}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>}
          {docs !== null && docs.length === 0 && <div style={emptyStyle}>Este cliente aún no tiene documentos.</div>}
          {(docs ?? []).map((d) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenInvoice(d.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenInvoice(d.id); } }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', borderRadius: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ color: 'var(--text)' }}>
                  {DOC_TYPE_LABEL[d.type]}{' '}
                  {d.number
                    ? <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--mod-finance)' }}>{d.number}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>(sin número)</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.issue_date}{d.due_date ? ` · vence ${d.due_date}` : ''}</span>
              </span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <StatusBadge status={d.status} docType={d.type} />
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)', minWidth: 90, textAlign: 'right' }}>{fmtMoney(d.total, d.currency)}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-componentes / estilos ───────────────────────────────────────────

const ADDR_PLACEHOLDER: Record<keyof BillingAddress, string> = {
  label: 'Etiqueta (Sede, Almacén…)',
  line1: 'Calle y número',
  line2: 'Piso / puerta',
  postal_code: 'C.P.',
  city: 'Ciudad',
  region: 'Provincia',
  country: 'País',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13,
};

const emptyStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' };

const btnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--amber)',
  border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnDashed: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'transparent',
  border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13,
};

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 150, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono, monospace)' : undefined }}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, accent, muted }: { label: string; value: string; accent: string; muted?: boolean }) {
  const c = muted ? 'var(--text)' : accent;
  const bar = muted ? 'var(--border)' : accent;
  return (
    <div style={{ flex: '1 1 150px', minWidth: 150, background: 'var(--card)', border: '1px solid var(--border)', borderTop: `3px solid ${bar}`, borderRadius: 'var(--radius-md, 6px)', padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: c, fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-dim)' }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>
    </div>
  );
}
