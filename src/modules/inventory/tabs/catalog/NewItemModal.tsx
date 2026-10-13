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

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useInventoryStore } from '@/stores/inventory.store';
import { CATEGORY_FIELD_TEMPLATES } from '@/modules/inventory/components/CustomFieldsEditor';
import { CategoryFieldsForm } from '@/modules/inventory/components/CategoryFieldsForm';
import { sanitizeCustomFields } from '@/modules/inventory/components/category-fields';
import {
  EMPTY_ITEM_FORM,
  itemFormToCreatePayload,
  type CreateItemPayload,
  type ItemFormFields,
} from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle, selectStyle } from '@/modules/inventory/ui';
import { CategoryCombo } from './CategoryCombo';
import { Field } from './catalog-ui';

// Los campos core vienen de ItemFormFields (types.ts); aquí solo se añaden
// los extras propios del alta (ubicación, stock, tags como texto, etc.).
interface NewItemForm extends ItemFormFields {
  location_id: string;
  quantity: string;
  track_stock: boolean;
  min_qty: string;
  uom: string;
  tags: string;
  description: string;
  customFields: Record<string, unknown>;
}

const EMPTY_FORM: NewItemForm = {
  ...EMPTY_ITEM_FORM,
  location_id: '',
  quantity: '1',
  track_stock: false,
  min_qty: '',
  uom: '',
  tags: '',
  description: '',
  customFields: {},
};

export function NewItemModal({ onClose }: { onClose: () => void }) {
  const { categories, locations, createItem } = useInventoryStore();
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof NewItemForm>(key: K, value: NewItemForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Al cambiar de categoría, los campos de PLANTILLA de otras categorías que
  // sigan vacíos se eliminan (no pueden colarse campos de vehicle en clothing).
  // Los que ya tienen valor se conservan: son datos del usuario (equivalen a
  // un campo añadido manualmente, que sigue estando permitido).
  const setCategory = (category: string) => {
    setForm(prev => {
      const newTemplate = new Set(CATEGORY_FIELD_TEMPLATES[category.trim().toLowerCase()] ?? []);
      const otherTemplateKeys = new Set(
        Object.entries(CATEGORY_FIELD_TEMPLATES)
          .filter(([cat]) => cat !== category.trim().toLowerCase())
          .flatMap(([, keys]) => keys),
      );
      const pruned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(prev.customFields)) {
        const isEmpty = v === '' || v === null || v === undefined;
        const fromOtherTemplate = otherTemplateKeys.has(k) && !newTemplate.has(k);
        if (fromOtherTemplate && isEmpty) continue;
        pruned[k] = v;
      }
      return { ...prev, category, customFields: pruned };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const body: CreateItemPayload = itemFormToCreatePayload(form);
    if (form.location_id) body.location_id = form.location_id;
    const qty = parseFloat(form.quantity);
    body.quantity = Number.isFinite(qty) ? qty : 1;
    if (form.track_stock) {
      body.track_stock = true;
      if (form.min_qty !== '') {
        const min = parseFloat(form.min_qty);
        if (Number.isFinite(min)) body.min_qty = min;
      }
      if (form.uom.trim()) body.uom = form.uom.trim();
    }
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) body.tags = tags;
    if (form.description.trim()) body.description = form.description.trim();
    const customFields = sanitizeCustomFields(form.customFields);
    if (Object.keys(customFields).length > 0) body.custom_fields = customFields;

    setSubmitting(true);
    try {
      await createItem(body);
      toast.success('Item created');
      onClose();
    } catch {
      toast.error('Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>New item</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Name *">
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} autoFocus required />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Category">
              <CategoryCombo value={form.category} onChange={setCategory} options={categories} />
            </Field>
            <Field label="Location">
              <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                <option value="">No location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <input style={inputStyle} value={form.brand} onChange={e => set('brand', e.target.value)} />
            </Field>
            <Field label="Model">
              <input style={inputStyle} value={form.model} onChange={e => set('model', e.target.value)} />
            </Field>
          </div>

          <Field label="Serial number">
            <input style={inputStyle} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Purchase date">
              <input style={inputStyle} type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
            </Field>
            <Field label="Purchase price">
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
            </Field>
            <Field label="Warranty until">
              <input style={inputStyle} type="date" value={form.warranty_until} onChange={e => set('warranty_until', e.target.value)} />
            </Field>
            <Field label="Quantity">
              <input style={inputStyle} type="number" min="0" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.track_stock} onChange={e => set('track_stock', e.target.checked)} />
            Track stock
          </label>

          {form.track_stock && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Min quantity">
                <input style={inputStyle} type="number" min="0" step="any" value={form.min_qty} onChange={e => set('min_qty', e.target.value)} />
              </Field>
              <Field label="Unit of measure">
                <input style={inputStyle} placeholder="unit, kg, l…" value={form.uom} onChange={e => set('uom', e.target.value)} />
              </Field>
            </div>
          )}

          <Field label="Tags (comma separated)">
            <input style={inputStyle} placeholder="electronics, office" value={form.tags} onChange={e => set('tags', e.target.value)} />
          </Field>

          <Field label="Description">
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>

          <Field label="Category fields">
            <CategoryFieldsForm
              value={form.customFields}
              onChange={next => set('customFields', next)}
              category={form.category.trim() || undefined}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" style={btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
