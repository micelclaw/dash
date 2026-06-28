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

// Ficha RICA de un contacto cliente/proveedor. Muestra (con color) todos sus
// datos de finanzas: nombre, razón social, CIF/NIF, divisa, condiciones de pago,
// dirección de facturación, web, emails, notas y tags. Los saldos (receivable /
// payable / invoiced / billed) y sus documentos vienen del detalle plano
// (GET /finance/contacts/:id). Editable in situ: guarda vía saveFinanceContact
// (PATCH /finance/contacts/:id). Un contacto puede ser cliente Y proveedor.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { RelationIntelligence } from '@/components/shared/RelationIntelligence';
import {
  Pencil, FileText, Globe, Mail, MapPin, StickyNote, Tag, Wallet,
  Save, XCircle, Loader2,
} from 'lucide-react';
import {
  useFinanceBillingStore,
  type FinanceContact,
  type FinanceContactDetail,
  type FinanceContactBalances,
  type FinanceRole,
  type BillingAddress,
  type FinanceDoc,
  type DocStatus,
  type DocType,
} from '@/stores/finance-billing.store';
import { STATUS_META, tintedPillStyle, statusLabel } from './statusMeta';

const ROLE_LABEL: Record<FinanceRole, string> = {
  customer: 'Cliente',
  supplier: 'Proveedor',
};

const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: 'Factura',
  quote: 'Presupuesto',
  bill: 'Factura recibida',
  receipt: 'Recibo',
  credit_note: 'Abono',
};

const CURRENCIES = ['EUR', 'USD', 'GBP'];

function fmtMoney(value: string | number | null | undefined, currency?: string | null): string {
  const n = Number(value ?? 0);
  const cur = currency || 'EUR'; // un contacto del CRM etiquetado puede no tener divisa → EUR
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

function StatusBadge({ status, docType }: { status: DocStatus; docType?: DocType }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{statusLabel(status, docType)}</span>;
}

function fmtAddress(a: BillingAddress): string {
  return [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country]
    .filter(Boolean)
    .join(', ');
}

export function ClienteDetalle({
  contactId,
  onOpenInvoice,
}: {
  contactId: string;
  onOpenInvoice: (docId: string) => void;
}) {
  const navigate = useNavigate();
  const { contacts, fetchContactDetail, saveFinanceContact } = useFinanceBillingStore();
  const contactFromList = contacts.find((c) => c.id === contactId) ?? null;

  const [detail, setDetail] = useState<FinanceContactDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos editables.
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [addr, setAddr] = useState<BillingAddress>({});

  const hydrate = useCallback((c: FinanceContact) => {
    setName(c.name ?? '');
    setLegalName(c.legal_name ?? '');
    setTaxId(c.tax_id ?? '');
    setCurrency(c.currency || 'EUR');
    setPaymentTerms(c.payment_terms != null ? String(c.payment_terms) : '');
    setWebsite(c.website ?? '');
    setNotes(c.notes ?? '');
    setTags((c.tags ?? []).join(', '));
    setAddr(c.billing_address ?? {});
  }, []);

  // Detalle (saldos + documentos) al cambiar de contacto.
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setEditing(false);
    fetchContactDetail(contactId)
      .then((d) => { if (alive) { setDetail(d); hydrate(d); } })
      .catch(() => { if (alive && contactFromList) { hydrate(contactFromList); } });
    return () => { alive = false; };
  }, [contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  const contact = detail ?? contactFromList;
  const docs: FinanceDoc[] | null = detail?.documents ?? null;
  const balances: FinanceContactBalances | null = detail?.balances ?? null;
  const isSupplier = !!contact?.roles.includes('supplier');
  const isCustomer = !!contact?.roles.includes('customer');

  // Robusto ante ambas formas: el backend aplana a string[], pero un email del CRM
  // puede llegar como objeto {address,label,primary} → extrae la dirección de texto.
  const emails = useMemo(() => (contact?.emails ?? [])
    .map((e) => (typeof e === 'string' ? e : (e && typeof e === 'object' ? (e as { address?: unknown }).address : null)))
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
    [contact?.emails]);

  const startEdit = () => { if (contact) hydrate(contact); setEditing(true); };
  const cancelEdit = () => { if (contact) hydrate(contact); setEditing(false); };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('El nombre no puede estar vacío'); return; }
    const pt = paymentTerms.trim();
    if (pt && (Number.isNaN(Number(pt)) || Number(pt) < 0)) { toast.error('Condiciones de pago: indica un número de días válido'); return; }
    setSaving(true);
    try {
      const cleanAddr = Object.fromEntries(
        Object.entries(addr).filter(([, v]) => (v ?? '').toString().trim() !== ''),
      ) as BillingAddress;
      const hasAddr = Object.keys(cleanAddr).length > 0;
      await saveFinanceContact({
        id: contactId,
        name: trimmed,
        roles: contact?.roles ?? ['customer'], // los roles se gestionan en el diálogo de alta/edición
        legal_name: legalName.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        currency,
        payment_terms: pt ? Number(pt) : null,
        website: website.trim() || undefined,
        billing_address: hasAddr ? cleanAddr : null,
        notes: notes.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      // Refresca el detalle para reflejar saldos/normalización del backend.
      const fresh = await fetchContactDetail(contactId).catch(() => null);
      setDetail(fresh ?? detail);
      setEditing(false);
      toast.success('Contacto actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!contact) {
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
            }}>{(contact.name || '?').charAt(0).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>{contact.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {contact.roles.map((r) => (
                  <span key={r} style={tintedPillStyle(r === 'supplier' ? 'var(--amber)' : 'var(--info)')}>{ROLE_LABEL[r]}</span>
                ))}
                {contact.legal_name && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {contact.legal_name}</span>}
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

      {/* Saldos (KPIs con color). Cliente=cobrar / Proveedor=pagar */}
      {balances && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {isCustomer && (
            <>
              <Kpi label="Facturado" value={fmtMoney(balances.invoiced, contact.currency)} accent="var(--amber)" />
              <Kpi label="Por cobrar" value={fmtMoney(balances.receivable, contact.currency)} accent="var(--info)" muted={Number(balances.receivable) <= 0} />
            </>
          )}
          {isSupplier && (
            <>
              <Kpi label="Comprado" value={fmtMoney(balances.billed, contact.currency)} accent="var(--error)" muted={Number(balances.billed) <= 0} />
              <Kpi label="Por pagar" value={fmtMoney(balances.payable, contact.currency)} accent="var(--warning)" muted={Number(balances.payable) <= 0} />
            </>
          )}
        </div>
      )}

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
            <Field label="Sitio web"><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" style={inputStyle} /></Field>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 10 }}>
            <InfoCard label="CIF / NIF" value={contact.tax_id || '—'} mono />
            <InfoCard label="Moneda" value={contact.currency || 'EUR'} mono />
            <InfoCard label="Condiciones de pago" value={contact.payment_terms != null ? `${contact.payment_terms} días` : '—'} />
            {contact.website && (
              <div style={{ flex: '1 1 150px', minWidth: 150, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Sitio web</div>
                <a href={contact.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--info)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={13} /> {contact.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Emails (del contacto del CRM) */}
      {!editing && emails.length > 0 && (
        <Section icon={<Mail size={14} />} title="Emails">
          <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {emails.map((e) => (
              <a key={e} href={`mailto:${e}`} style={{ fontSize: 13, color: 'var(--info)', textDecoration: 'none' }}>{e}</a>
            ))}
          </div>
        </Section>
      )}

      {/* Dirección de facturación (objeto único) */}
      <Section icon={<MapPin size={14} />} title="Dirección de facturación">
        {editing ? (
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['line1', 'line2', 'postal_code', 'city', 'region', 'country'] as (keyof BillingAddress)[]).map((f) => (
              <input
                key={f}
                value={(addr[f] as string) ?? ''}
                onChange={(e) => setAddr((prev) => ({ ...prev, [f]: e.target.value }))}
                placeholder={ADDR_PLACEHOLDER[f]}
                style={inputStyle}
              />
            ))}
          </div>
        ) : (
          <div style={{ paddingTop: 6 }}>
            {!contact.billing_address || fmtAddress(contact.billing_address) === '' ? (
              <div style={emptyStyle}>Sin dirección.</div>
            ) : (
              <div style={{ padding: '7px 0', fontSize: 13, color: 'var(--text)' }}>{fmtAddress(contact.billing_address)}</div>
            )}
          </div>
        )}
      </Section>

      {/* Notas + Tags */}
      <Section icon={<StickyNote size={14} />} title="Notas">
        {editing ? (
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas sobre el contacto…" style={{ ...inputStyle, resize: 'vertical' }} />
            <Field label="Etiquetas (separadas por coma)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, recurrente, moroso" style={inputStyle} />
            </Field>
          </div>
        ) : (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 13, color: contact.notes ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: (contact.tags ?? []).length ? 10 : 0 }}>
              {contact.notes || 'Sin notas.'}
            </div>
            {(contact.tags ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                {(contact.tags ?? []).map((t) => (
                  <span key={t} style={tintedPillStyle('var(--mod-finance)')}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Enlace al contacto del CRM */}
      {!editing && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate(`/contacts?id=${contact.id}`)}
            style={{ ...btnGhost, fontSize: 12 }}
          >
            <FileText size={13} /> Ver en el CRM
          </button>
        </div>
      )}

      {/* Documentos del contacto — lista clicable */}
      <Section icon={<FileText size={14} />} title={`Documentos (${docs?.length ?? 0})`}>
        <div style={{ paddingTop: 6 }}>
          {docs === null && <div style={emptyStyle}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>}
          {docs !== null && docs.length === 0 && <div style={emptyStyle}>Este contacto aún no tiene documentos.</div>}
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

      {/* Inteligencia de relaciones: Related Entities + Similar Semantic + Graph Proximity */}
      <div style={{ marginTop: 8 }}>
        <RelationIntelligence sourceType="contact" sourceId={contactId} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-componentes / estilos ───────────────────────────────────────────

const ADDR_PLACEHOLDER: Record<keyof BillingAddress, string> = {
  label: 'Etiqueta',
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
