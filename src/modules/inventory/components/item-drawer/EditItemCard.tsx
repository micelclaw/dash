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
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import {
  itemFormToUpdatePayload,
  itemToFormFields,
  type InventoryItem,
  type ItemFormFields,
  type UpdateItemPayload,
} from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle } from '@/modules/inventory/ui';
import { CategoryFieldsForm } from '@/modules/inventory/components/CategoryFieldsForm';
import { sanitizeCustomFields } from '@/modules/inventory/components/category-fields';
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
  const { t } = useI18n();
  // Snapshot al abrir la edición — se remonta al reabrir (mismo comportamiento
  // que el openEdit original).
  const [form, setForm] = useState<ItemFormFields>(() => itemToFormFields(item));
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(() => item.custom_fields ?? {});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t('inventory.item.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...itemFormToUpdatePayload(form), custom_fields: sanitizeCustomFields(customFields) });
      toast.success(t('inventory.drawer.itemUpdated'));
      onClose();
    } catch {
      toast.error(t('inventory.drawer.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const generateTag = async () => {
    try {
      const updated = await onGenerateTag();
      const generatedTag = updated.asset_tag ?? '';
      setForm(f => ({ ...f, asset_tag: generatedTag }));
      toast.success(t('inventory.drawer.assetTagGenerated', { tag: generatedTag }));
    } catch {
      toast.error(t('inventory.drawer.generateAssetTagFailed'));
    }
  };

  return (
    <div style={{ ...cardStyle, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={sectionLabel}>{t('inventory.drawer.editSection')}</span>
      </div>
      <div>
        <label style={editLabelStyle}>{t('inventory.item.categoryFields')}</label>
        <CategoryFieldsForm category={form.category} value={customFields} onChange={setCustomFields} />
      </div>
      <div>
        <label style={editLabelStyle}>{t('inventory.drawer.nameRequired')}</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          aria-label={t('inventory.item.name')}
          autoFocus
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={editLabelStyle}>{t('inventory.drawer.category')}</label>
          <input style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.serialNumber')}</label>
          <input style={inputStyle} value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.drawer.assetTag')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={inputStyle}
              placeholder="INV-2026-00042"
              value={form.asset_tag}
              onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))}
              aria-label={t('inventory.drawer.assetTag')}
            />
            <button type="button" style={{ ...btnSecondary, padding: '6px 10px', flexShrink: 0 }} onClick={() => void generateTag()} title={t('inventory.drawer.generateTag')}>
              {t('inventory.drawer.generate')}
            </button>
          </div>
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.brand')}</label>
          <input style={inputStyle} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.model')}</label>
          <input style={inputStyle} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.purchaseDate')}</label>
          <input style={inputStyle} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.purchasePrice')}</label>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
        </div>
        <div>
          <label style={editLabelStyle}>{t('inventory.item.warrantyUntil')}</label>
          <input style={inputStyle} type="date" value={form.warranty_until} onChange={e => setForm(f => ({ ...f, warranty_until: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={btnSecondary} disabled={saving} onClick={onClose}>{t('inventory.drawer.cancel')}</button>
        <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void save()}>
          {saving ? t('inventory.drawer.saving') : t('inventory.drawer.save')}
        </button>
      </div>
    </div>
  );
}
