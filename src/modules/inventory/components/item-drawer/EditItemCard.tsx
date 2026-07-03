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

import { useState } from 'react';
import { toast } from 'sonner';
import {
  itemFormToUpdatePayload,
  itemToFormFields,
  type InventoryItem,
  type ItemFormFields,
  type UpdateItemPayload,
} from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle } from '@/modules/inventory/ui';
import { cardStyle, editLabelStyle, sectionLabel } from './drawer-ui';

interface EditItemCardProps {
  item: InventoryItem;
  /** Persiste el PATCH (el padre decide store vs copia local). */
  onSubmit: (body: UpdateItemPayload) => Promise<void>;
  onClose: () => void;
  /** Genera el siguiente asset tag en el backend y devuelve el item actualizado. */
  onGenerateTag: () => Promise<InventoryItem>;
}

/**
 * Card de edición de los campos core (nombre/categoría/marca/modelo/serial/
 * compra/garantía). Antes no había forma de editarlos tras crear el item;
 * updateItem ya soporta cualquier campo, así que el drawer es el lugar natural.
 */
export function EditItemCard({ item, onSubmit, onClose, onGenerateTag }: EditItemCardProps) {
  // Snapshot al abrir la edición — se remonta al reabrir (mismo comportamiento
  // que el openEdit original).
  const [form, setForm] = useState<ItemFormFields>(() => itemToFormFields(item));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(itemFormToUpdatePayload(form));
      toast.success('Item updated');
      onClose();
    } catch {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const generateTag = async () => {
    try {
      const updated = await onGenerateTag();
      setForm(f => ({ ...f, asset_tag: updated.asset_tag ?? '' }));
      toast.success(`Asset tag ${updated.asset_tag}`);
    } catch {
      toast.error('Failed to generate asset tag');
    }
  };

  return (
    <div style={{ ...cardStyle, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={sectionLabel}>Edit item</span>
      </div>
      <div>
        <label style={editLabelStyle}>Name *</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          aria-label="Item name"
          autoFocus
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={editLabelStyle}>Category</label>
          <input style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Serial number</label>
          <input style={inputStyle} value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Asset tag</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={inputStyle}
              placeholder="INV-2026-00042"
              value={form.asset_tag}
              onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))}
              aria-label="Asset tag"
            />
            <button type="button" style={{ ...btnSecondary, padding: '6px 10px', flexShrink: 0 }} onClick={() => void generateTag()} title="Auto-generate the next asset tag">
              Gen
            </button>
          </div>
        </div>
        <div>
          <label style={editLabelStyle}>Brand</label>
          <input style={inputStyle} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Model</label>
          <input style={inputStyle} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Purchase date</label>
          <input style={inputStyle} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Purchase price</label>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>Warranty until</label>
          <input style={inputStyle} type="date" value={form.warranty_until} onChange={e => setForm(f => ({ ...f, warranty_until: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={btnSecondary} disabled={saving} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
