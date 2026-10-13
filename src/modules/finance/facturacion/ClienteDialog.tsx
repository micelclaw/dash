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

// Alta/edición de un CONTACTO cliente/proveedor. Un cliente/proveedor ES un
// contacto del CRM; sus datos de finanzas viven en él. Si recibe `contactId`
// precarga y hace PATCH; si no, crea uno nuevo con POST. Los roles
// (Cliente/Proveedor) son multi-selección. "Usar un contacto del CRM" marca un
// contacto existente con el rol elegido (POST /finance/contacts/:id/role).

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Users, Search, Loader2 } from 'lucide-react';
import { useFinanceBillingStore, type FinanceRole } from '@/stores/finance-billing.store';
import { api } from '@/services/api';
import { useEscapeClose } from '../use-escape-close';

interface CrmContact { id: string; display_name: string; company: string | null }

const CURRENCIES = ['EUR', 'USD', 'GBP'];

export function ClienteDialog({ open, onClose, contactId, role: roleProp = 'customer' }: { open: boolean; onClose: () => void; contactId?: string; role?: FinanceRole }) {
  const { contacts, saveFinanceContact, tagContact } = useFinanceBillingStore();
  const editing = contacts.find((c) => c.id === contactId) ?? null;

  // ¿Es un alta de proveedor? Determina los textos contextuales del diálogo.
  const isSupplier = roleProp === 'supplier';
  const entityLabel = isSupplier ? 'supplier' : 'customer';
  const entityLabelCap = isSupplier ? 'Supplier' : 'Customer';

  // Roles del contacto (multi-selección): cliente y/o proveedor.
  const [isCustomer, setIsCustomer] = useState(false);
  const [isSupplierRole, setIsSupplierRole] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  // Dirección de facturación (objeto único) + sitio web
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Alta "desde un contacto del CRM" (cruce sin duplicar): marca un contacto
  // existente con el rol elegido.
  const [crmOpen, setCrmOpen] = useState(false);
  const [crmQuery, setCrmQuery] = useState('');
  const [crmResults, setCrmResults] = useState<CrmContact[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  useEffect(() => {
    if (!crmOpen) return;
    let cancelled = false;
    setCrmLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ data: CrmContact[] }>('/contacts', { search: crmQuery || undefined, limit: '8' } as Record<string, string | undefined>);
        if (!cancelled) setCrmResults(r.data ?? []);
      } catch {
        if (!cancelled) setCrmResults([]);
      } finally {
        if (!cancelled) setCrmLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [crmOpen, crmQuery]);

  const pickContact = async (c: CrmContact) => {
    setSaving(true);
    try {
      // Marca el contacto del CRM existente con el rol activo (o el de la prop).
      const role: FinanceRole = isSupplierRole && !isCustomer ? 'supplier' : isCustomer && !isSupplierRole ? 'customer' : roleProp;
      await tagContact(c.id, role);
      toast.success(`${role === 'supplier' ? 'Supplier' : 'Customer'} vinculado: ${c.company || c.display_name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t link the contact');
    } finally {
      setSaving(false);
    }
  };

  // Precarga / reset al abrir.
  useEffect(() => {
    if (!open) return;
    setEmail('');
    if (editing) {
      setIsCustomer(editing.roles.includes('customer'));
      setIsSupplierRole(editing.roles.includes('supplier'));
      setName(editing.name);
      setLegalName(editing.legal_name ?? '');
      setTaxId(editing.tax_id ?? '');
      setCurrency(editing.currency || 'EUR');
      setPaymentTerms(editing.payment_terms != null ? String(editing.payment_terms) : '');
      setNotes(editing.notes ?? '');
      setTags((editing.tags ?? []).join(', '));
      const addr = editing.billing_address;
      setLine1(addr?.line1 ?? '');
      setLine2(addr?.line2 ?? '');
      setCity(addr?.city ?? '');
      setPostalCode(addr?.postal_code ?? '');
      setRegion(addr?.region ?? '');
      setCountry(addr?.country ?? '');
      setWebsite(editing.website ?? '');
    } else {
      setIsCustomer(roleProp === 'customer');
      setIsSupplierRole(roleProp === 'supplier');
      setName('');
      setLegalName('');
      setTaxId('');
      setCurrency('EUR');
      setPaymentTerms('');
      setNotes('');
      setTags('');
      setLine1('');
      setLine2('');
      setCity('');
      setPostalCode('');
      setRegion('');
      setCountry('');
      setWebsite('');
    }
    setCrmOpen(false);
    setCrmQuery('');
    setCrmResults([]);
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [open, contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEscapeClose(open, onClose);

  if (!open) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Enter the name'); return; }
    const roles: FinanceRole[] = [];
    if (isCustomer) roles.push('customer');
    if (isSupplierRole) roles.push('supplier');
    if (roles.length === 0) { toast.error('Tick at least one role (Customer or Supplier)'); return; }
    const pt = paymentTerms.trim();
    if (pt && (Number.isNaN(Number(pt)) || Number(pt) < 0)) { toast.error('Due date: enter a valid number of days'); return; }
    setSaving(true);
    try {
      // Dirección de facturación (objeto único). Vacíos → null.
      const addr = {
        line1: line1.trim() || null,
        line2: line2.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        region: region.trim() || null,
        country: country.trim() || null,
      };
      const hasAddr = Object.values(addr).some((v) => v != null);
      const websiteTrimmed = website.trim();

      await saveFinanceContact({
        id: editing?.id,
        name: trimmed,
        roles,
        tax_id: taxId.trim() || undefined,
        legal_name: legalName.trim() || undefined,
        currency,
        payment_terms: pt ? Number(pt) : null,
        website: websiteTrimmed || undefined,
        billing_address: hasAddr ? addr : null,
        notes: notes.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        ...(editing ? {} : { email: email.trim() || undefined }),
      });
      toast.success(editing ? `${entityLabelCap} actualizado` : `${entityLabelCap} creado`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t save');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  // Checkbox de rol con aspecto de toggle.
  const RoleCheck = ({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) => (
    <button onClick={onToggle} type="button" style={{
      flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm, 4px)', cursor: 'pointer', fontSize: 13,
      border: '1px solid', borderColor: checked ? 'var(--mod-finance)' : 'var(--border)',
      background: checked ? 'var(--mod-finance)' : 'transparent',
      color: checked ? '#0a0a0a' : 'var(--text-dim)', fontWeight: checked ? 600 : 500,
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', maxHeight: '84vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{editing ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Alta desde un contacto del CRM (cruce sin duplicar) */}
        {!editing && (
          <div style={{ marginBottom: 14 }}>
            {!crmOpen ? (
              <button onClick={() => setCrmOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--mod-finance)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Users size={14} /> Usar un contacto del CRM
              </button>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 10, background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Marcar contacto del CRM como {entityLabel}</span>
                  <button onClick={() => setCrmOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Type it in</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input autoFocus value={crmQuery} onChange={(e) => setCrmQuery(e.target.value)} placeholder="Buscar contacto…" style={{ ...fieldStyle, padding: '6px 8px' }} />
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {crmLoading ? (
                    <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>
                  ) : crmResults.length === 0 ? (
                    <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No contacts.</div>
                  ) : crmResults.map((c) => (
                    <button key={c.id} onClick={() => pickContact(c)} disabled={saving} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '7px 10px', background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-sm, 4px)', cursor: saving ? 'wait' : 'pointer', textAlign: 'left', width: '100%' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.company || c.display_name}</span>
                      {c.company && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.display_name}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="p.ej. Acme S.L." style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Legal name <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Nombre legal completo" style={fieldStyle} />
          </div>

          {/* Dirección de facturación (sale en el PDF de la factura) */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 12, background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>
              Dirección de facturación <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(opcional)</span>
            </span>
            <div>
              <label style={labelStyle}>Street</label>
              <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street and number" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Line 2 <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
              <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Piso, puerta, etc." style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>Postcode</label>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="28001" style={fieldStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madrid" style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Province / Region</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Madrid" style={fieldStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Spain" style={fieldStyle} />
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Sitio web <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" style={fieldStyle} />
          </div>

          {!editing && (
            <div>
              <label style={labelStyle}>Contact email <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isSupplier ? 'proveedor@empresa.com' : 'cliente@empresa.com'}
                style={fieldStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Se creará un contacto del CRM con este {entityLabel}.
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tax ID</label>
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="B12345678" style={{ ...fieldStyle, fontFamily: 'var(--font-mono, monospace)' }} />
            </div>
            <div style={{ width: 120 }}>
              <label style={labelStyle}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={fieldStyle}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rol <span style={{ color: 'var(--text-muted)' }}>(uno o ambos)</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <RoleCheck checked={isCustomer} onToggle={() => setIsCustomer((v) => !v)} label="Customer" />
                <RoleCheck checked={isSupplierRole} onToggle={() => setIsSupplierRole((v) => !v)} label="Supplier" />
              </div>
            </div>
            <div style={{ width: 130 }}>
              <label style={labelStyle}>Vencimiento <span style={{ color: 'var(--text-muted)' }}>(días)</span></label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} inputMode="numeric" placeholder="30" style={{ ...fieldStyle, fontFamily: 'var(--font-mono, monospace)' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notas <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={`Notas internas sobre el ${entityLabel}…`} style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Etiquetas <span style={{ color: 'var(--text-muted)' }}>(separadas por coma)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, recurrente" style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 16px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Guardando…' : editing ? 'Save changes' : `Crear ${entityLabel}`}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
