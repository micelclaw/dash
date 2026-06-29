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

// Faceta PRODUCTO de un artículo (F1, catálogo comercial compartido). Permite
// marcar un artículo como Producto vendible / Servicio, fijar su PVP y el método
// de valoración. Solo un Producto con stock genera coste de ventas (COGS) al
// venderse (Debe 600 / Haber 300). Patch directo a PATCH /inventory/items/:id.

import { useState, type CSSProperties } from 'react';
import { Tags } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { InventoryItem } from '@/modules/inventory/types';

const cardStyle: CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
};
const titleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)',
};
const labelStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 };
const inputStyle: CSSProperties = {
  width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm, 4px)', color: 'var(--text)', fontSize: 13,
};

type Kind = 'possession' | 'product' | 'service';
type Method = 'average' | 'fifo' | 'standard';

const KINDS: Array<{ v: Kind; label: string }> = [
  { v: 'possession', label: 'Posesión' },
  { v: 'product', label: 'Producto' },
  { v: 'service', label: 'Servicio' },
];
const METHODS: Array<{ v: Method; label: string }> = [
  { v: 'average', label: 'Coste medio' },
  { v: 'fifo', label: 'FIFO' },
  { v: 'standard', label: 'Estándar' },
];

export function ProductSettingsCard({ item, onSaved }: { item: InventoryItem; onSaved: () => void | Promise<void> }) {
  const [kind, setKind] = useState<Kind>(item.item_kind ?? 'possession');
  const [salePrice, setSalePrice] = useState<string>(item.sale_price ?? '');
  const [valuation, setValuation] = useState<Method>(item.valuation_method ?? 'average');
  const [trackStock, setTrackStock] = useState<boolean>(item.track_stock);
  const [saving, setSaving] = useState(false);

  const dirty =
    kind !== (item.item_kind ?? 'possession') ||
    (salePrice || '') !== (item.sale_price ?? '') ||
    valuation !== (item.valuation_method ?? 'average') ||
    trackStock !== item.track_stock;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/inventory/items/${item.id}`, {
        item_kind: kind,
        sale_price: salePrice.trim() === '' ? null : salePrice.trim(),
        valuation_method: valuation,
        track_stock: trackStock,
      });
      toast.success('Producto actualizado');
      await onSaved();
    } catch {
      toast.error('No se pudo actualizar el producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={titleStyle}><Tags size={12} /> Producto / Comercial</div>

      {/* Tipo: posesión / producto / servicio (segmented) */}
      <div>
        <div style={labelStyle}>Tipo de artículo</div>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', overflow: 'hidden' }}>
          {KINDS.map((k) => (
            <button
              key={k.v}
              type="button"
              onClick={() => setKind(k.v)}
              style={{
                padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                background: kind === k.v ? 'var(--mod-inventory, var(--amber))' : 'transparent',
                color: kind === k.v ? '#06060a' : 'var(--text)',
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>
          Un Producto con stock valora en los libros (cuenta 300) y genera coste de ventas al venderse.
        </div>
      </div>

      {kind !== 'possession' && (
        <div>
          <div style={labelStyle}>Precio de venta (PVP)</div>
          <input
            type="number" step="0.01" min="0" inputMode="decimal"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="0.00"
            style={{ ...inputStyle, width: 160 }}
          />
        </div>
      )}

      {kind === 'product' && (
        <>
          <div>
            <div style={labelStyle}>Método de valoración</div>
            <select value={valuation} onChange={(e) => setValuation(e.target.value as Method)} style={{ ...inputStyle, width: 200 }}>
              {METHODS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
            Controlar stock (necesario para valorar en libros y calcular el coste de ventas)
          </label>
        </>
      )}

      {dirty && (
        <div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm, 4px)',
              border: 'none', cursor: saving ? 'default' : 'pointer',
              background: 'var(--mod-inventory, var(--amber))', color: '#06060a',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
