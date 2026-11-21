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

// Clientes/Proveedores — lista (izq) + ficha RICA del contacto seleccionado
// (der). Cada item es un CONTACTO cliente/proveedor; los roles se muestran como
// chips. La ficha (ClienteDetalle) muestra datos fiscales/de pago, dirección,
// emails, notas/tags y los documentos del contacto; es editable in situ.

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  useFinanceBillingStore,
  type FinanceRole,
} from '@/stores/finance-billing.store';
import { ClienteDialog } from './ClienteDialog';
import { ClienteDetalle } from './ClienteDetalle';
import { useFacturacionNav } from './navigation';
import { tintedPillStyle } from './statusMeta';
import { useI18n } from '@/i18n';

const ROLE_LABEL: Record<FinanceRole, string> = {
  customer: 'finance.billing.customer',
  supplier: 'finance.billing.supplier',
};

// Color de acento por rol: cliente = azul (--info), proveedor = ámbar (--amber).
const ROLE_COLOR: Record<FinanceRole, string> = {
  customer: 'var(--info)',
  supplier: 'var(--amber)',
};

type RoleFilter = 'all' | 'customer' | 'supplier';

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'finance.billing.contacts.all' },
  { value: 'customer', label: 'finance.billing.contacts.customers' },
  { value: 'supplier', label: 'finance.billing.contacts.suppliers' },
];

export function FacturacionClientesTab() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { contacts, selectedContactId, setSelectedContact } = useFinanceBillingStore();
  const { openInvoice } = useFacturacionNav();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const listed = roleFilter === 'all' ? contacts : contacts.filter((c) => c.roles.includes(roleFilter));
  const selected = contacts.find((c) => c.id === selectedContactId) ?? listed[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedContactId) setSelectedContact(selected.id);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : '100%', minHeight: isMobile ? undefined : 360 }}>
      {/* Lista de contactos */}
      <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0, maxHeight: isMobile ? 240 : undefined, borderRight: isMobile ? 'none' : '1px solid var(--border)', borderBottom: isMobile ? '1px solid var(--border)' : 'none', overflowY: 'auto', padding: 12 }}>
        {/* Filtro de rol (segmented): Todos | Clientes | Proveedores */}
        <div style={{ display: 'flex', gap: 2, padding: 2, marginBottom: 10, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--border)' }}>
          {ROLE_FILTERS.map((f) => {
            const active = roleFilter === f.value;
            return (
              <button key={f.value} onClick={() => setRoleFilter(f.value)} style={{
                flex: 1, padding: '5px 6px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                background: active ? 'var(--mod-finance)' : 'transparent', color: active ? '#fff' : 'var(--text-dim)',
                border: 'none', borderRadius: 'calc(var(--radius-md, 6px) - 2px)', whiteSpace: 'nowrap',
              }}>
                {t(f.label)}
              </button>
            );
          })}
        </div>
        {listed.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 4px' }}>
            {t(roleFilter === 'supplier' ? 'finance.billing.contacts.noSuppliers' : roleFilter === 'customer' ? 'finance.billing.contacts.noCustomers' : 'finance.billing.contacts.noContacts')}
          </div>
        )}
        {listed.map((c) => {
          const active = c.id === selected?.id;
          return (
            <button key={c.id} onClick={() => setSelectedContact(c.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
              background: active ? 'var(--surface-hover)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--mod-finance)' : 'var(--border)',
              borderRadius: 'var(--radius-md, 6px)', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {c.roles.map((r) => (
                    <span key={r} style={tintedPillStyle(ROLE_COLOR[r])}>{t(ROLE_LABEL[r])}</span>
                  ))}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{c.tax_id || c.company || '—'}</span>
            </button>
          );
        })}
        <button onClick={() => setDialogOpen(true)} style={{ width: '100%', padding: '8px 12px', marginTop: 4, cursor: 'pointer', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Plus size={14} /> {t('finance.billing.contacts.create')}
        </button>
      </div>

      {/* Ficha rica del contacto — editable in situ */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>{t('finance.billing.contacts.getStarted')}</div>}
        {selected && (
          <ClienteDetalle key={selected.id} contactId={selected.id} onOpenInvoice={openInvoice} />
        )}
      </div>

      <ClienteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
