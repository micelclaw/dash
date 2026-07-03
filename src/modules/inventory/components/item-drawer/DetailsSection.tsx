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

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CustomFieldsEditor } from '@/modules/inventory/components/CustomFieldsEditor';
import type { InventoryItem, UpdateItemPayload } from '@/modules/inventory/types';
import { btnPrimary, inputStyle } from '@/modules/inventory/ui';
import { DetailRow, sectionLabel } from './drawer-ui';

interface DetailsSectionProps {
  item: InventoryItem;
  readOnly: boolean;
  locationName: string;
  /** Persiste el PATCH (el padre decide store vs copia local). */
  onUpdate: (body: UpdateItemPayload) => Promise<void>;
}

/** Sección "Details" plegable: cantidad editable + metadatos + custom fields. */
export function DetailsSection({ item, readOnly, locationName, onUpdate }: DetailsSectionProps) {
  const [open, setOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(item.quantity);
  const [fieldsDraft, setFieldsDraft] = useState<Record<string, unknown>>({ ...(item.custom_fields ?? {}) });

  // Keep quantity draft in sync with the loaded item.
  useEffect(() => {
    setQtyDraft(item.quantity);
  }, [item.quantity]);

  // Re-init the custom fields draft when the item (re)loads. The drawer
  // remounts per itemId (key in ItemDrawer), so this only tracks async load +
  // post-save refreshes of the same item.
  useEffect(() => {
    setFieldsDraft({ ...(item.custom_fields ?? {}) });
  }, [item.custom_fields]);

  const commitQty = async () => {
    const n = parseFloat(qtyDraft);
    if (!Number.isFinite(n) || n < 0) {
      setQtyDraft(item.quantity);
      return;
    }
    if (n === parseFloat(item.quantity)) return;
    try {
      await onUpdate({ quantity: n });
      toast.success('Quantity updated');
    } catch {
      toast.error('Failed to update quantity');
      setQtyDraft(item.quantity);
    }
  };

  const handleSaveFields = async () => {
    try {
      await onUpdate({ custom_fields: fieldsDraft });
      toast.success('Fields saved');
    } catch {
      toast.error('Failed to save fields');
    }
  };

  const fieldsDirty = JSON.stringify(fieldsDraft) !== JSON.stringify(item.custom_fields ?? {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...sectionLabel,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: 0,
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Details
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DetailRow
            label="Quantity"
            value={
              item.track_stock && !readOnly ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    value={qtyDraft}
                    onChange={e => setQtyDraft(e.target.value)}
                    onBlur={() => void commitQty()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    style={{ ...inputStyle, width: 72, padding: '3px 6px' }}
                  />
                  {item.uom}
                </span>
              ) : (
                `${item.quantity} ${item.uom}`
              )
            }
          />
          <DetailRow label="Min qty" value={item.min_qty ? `${item.min_qty} ${item.uom}` : '—'} />
          {(item.meter_unit || item.meter_value) && (
            <DetailRow label="Meter unit" value={item.meter_unit ?? '—'} />
          )}
          <DetailRow label="Supplier SKU" value={item.supplier_sku ?? '—'} />
          <DetailRow label="Location" value={locationName} />
          <DetailRow label="Created by" value={item.created_by} />
          <DetailRow label="Description" value={item.description ?? '—'} />
          {readOnly ? (
            item.custom_fields &&
            Object.entries(item.custom_fields).map(([key, value]) => (
              <DetailRow
                key={key}
                label={key}
                value={typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—')}
              />
            ))
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                  }}
                >
                  Custom fields
                </span>
                {fieldsDirty && (
                  <button
                    style={{ ...btnPrimary, padding: '2px 8px', fontSize: '0.6875rem' }}
                    onClick={() => void handleSaveFields()}
                  >
                    Save fields
                  </button>
                )}
              </div>
              <CustomFieldsEditor
                value={fieldsDraft}
                onChange={setFieldsDraft}
                category={item.category}
                compact
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
