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

// Clientes — lista (izq) + ficha RICA del cliente seleccionado (der, A5).
// Molde = CuentasTab de la lente Personal: layout flex, lista de botones a la
// izquierda, ficha a la derecha. La ficha (ClienteDetalle) muestra datos
// fiscales/de pago, direcciones, contactos, notas/tags, datos extra
// (custom_fields) y el resumen de facturas; es editable in situ.

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  useFinanceBillingStore,
  type Party,
} from '@/stores/finance-billing.store';
import { ClienteDialog } from './ClienteDialog';
import { ClienteDetalle } from './ClienteDetalle';
import { useFacturacionNav } from './navigation';
import { tintedPillStyle } from './statusMeta';

const KIND_LABEL: Record<Party['kind'], string> = {
  customer: 'Cliente',
  supplier: 'Proveedor',
  employee: 'Empleado',
  self: 'Propio',
};

// Color de acento por tipo de party (sutil, coherente con la paleta D13):
// cliente = azul (--info), proveedor = ámbar (--amber).
const KIND_COLOR: Partial<Record<Party['kind'], string>> = {
  customer: 'var(--info)',
  supplier: 'var(--amber)',
};

type KindFilter = 'all' | 'customer' | 'supplier';

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'customer', label: 'Clientes' },
  { value: 'supplier', label: 'Proveedores' },
];

export function FacturacionClientesTab() {
  const { parties, selectedPartyId, setSelectedParty } = useFinanceBillingStore();
  const { openInvoice } = useFacturacionNav();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

  // Solo clientes/proveedores facturables en la lista (los principales del módulo).
  const facturables = parties.filter((p) => p.kind === 'customer' || p.kind === 'supplier');
  const listed = kindFilter === 'all' ? facturables : facturables.filter((p) => p.kind === kindFilter);
  const selected = parties.find((p) => p.id === selectedPartyId) ?? listed[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedPartyId) setSelectedParty(selected.id);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 360 }}>
      {/* Lista de clientes */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 12 }}>
        {/* Filtro de tipo (segmented): Todos | Clientes | Proveedores */}
        <div style={{ display: 'flex', gap: 2, padding: 2, marginBottom: 10, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--border)' }}>
          {KIND_FILTERS.map((f) => {
            const active = kindFilter === f.value;
            return (
              <button key={f.value} onClick={() => setKindFilter(f.value)} style={{
                flex: 1, padding: '5px 6px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                background: active ? 'var(--mod-finance)' : 'transparent', color: active ? '#fff' : 'var(--text-dim)',
                border: 'none', borderRadius: 'calc(var(--radius-md, 6px) - 2px)', whiteSpace: 'nowrap',
              }}>
                {f.label}
              </button>
            );
          })}
        </div>
        {listed.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 4px' }}>
            {kindFilter === 'supplier' ? 'Aún no hay proveedores.' : kindFilter === 'customer' ? 'Aún no hay clientes.' : 'Aún no hay clientes ni proveedores.'}
          </div>
        )}
        {listed.map((p) => {
          const active = p.id === selected?.id;
          const kindColor = KIND_COLOR[p.kind] ?? 'var(--text-muted)';
          return (
            <button key={p.id} onClick={() => setSelectedParty(p.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
              background: active ? 'var(--surface-hover)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--mod-finance)' : 'var(--border)',
              borderRadius: 'var(--radius-md, 6px)', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ ...tintedPillStyle(kindColor), flexShrink: 0 }}>{KIND_LABEL[p.kind]}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{p.tax_id || KIND_LABEL[p.kind]}</span>
            </button>
          );
        })}
        <button onClick={() => setDialogOpen(true)} style={{ width: '100%', padding: '8px 12px', marginTop: 4, cursor: 'pointer', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Plus size={14} /> Cliente
        </button>
      </div>

      {/* Ficha rica del cliente (A5) — editable in situ */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Crea un cliente para empezar.</div>}
        {selected && (
          <ClienteDetalle key={selected.id} partyId={selected.id} onOpenInvoice={openInvoice} />
        )}
      </div>

      <ClienteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
