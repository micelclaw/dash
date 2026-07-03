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
import { Check, Gauge } from 'lucide-react';
import { fmtMeter, type InventoryItem } from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle } from '@/modules/inventory/ui';
import { cardStyle, fmtDate } from './drawer-ui';

interface MeterCardProps {
  item: InventoryItem;
  readOnly: boolean;
  /** Registra la lectura; devuelve true si se guardó (para resetear el form). */
  onSubmitReading: (value: number, unit?: string) => Promise<boolean>;
}

/** Medidor de desgaste (km, horas…): mostrar/actualizar o añadir uno nuevo. */
export function MeterCard({ item, readOnly, onSubmitReading }: MeterCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [unitDraft, setUnitDraft] = useState('km');
  const [unitCustom, setUnitCustom] = useState('');
  const [confirmLower, setConfirmLower] = useState(false);

  const resetForms = () => {
    setEditOpen(false);
    setAddOpen(false);
    setDraft('');
    setUnitCustom('');
    setConfirmLower(false);
  };

  const submit = async (value: number, unit?: string) => {
    const ok = await onSubmitReading(value, unit);
    if (ok) resetForms();
  };

  const commitUpdate = () => {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) return;
    const current = item.meter_value !== null ? parseFloat(item.meter_value) : NaN;
    if (Number.isFinite(current) && n < current && !confirmLower) {
      setConfirmLower(true);
      return;
    }
    void submit(n);
  };

  const commitAdd = () => {
    const n = parseFloat(draft);
    const unit = unitDraft === 'other' ? unitCustom.trim() : unitDraft;
    if (!Number.isFinite(n) || n < 0 || !unit) return;
    void submit(n, unit);
  };

  if (item.meter_unit || item.meter_value) {
    return (
      <div style={{ ...cardStyle, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Gauge size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
            Meter: {fmtMeter(item.meter_value, item.meter_unit)}
          </span>
          {item.meter_updated_at && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              updated {fmtDate(item.meter_updated_at)}
            </span>
          )}
          {!readOnly && !editOpen && (
            <button
              style={{ ...btnSecondary, marginLeft: 'auto', padding: '2px 8px', fontSize: '0.6875rem' }}
              onClick={() => {
                setDraft('');
                setConfirmLower(false);
                setEditOpen(true);
              }}
            >
              Update
            </button>
          )}
        </div>
        {!readOnly && editOpen && (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                min={0}
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  setConfirmLower(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitUpdate();
                  if (e.key === 'Escape') resetForms();
                }}
                placeholder={`New reading${item.meter_unit ? ` (${item.meter_unit})` : ''}`}
                autoFocus
                style={{ ...inputStyle, flex: 1 }}
                aria-label="New meter reading"
              />
              <button
                style={{ ...btnPrimary, padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                onClick={commitUpdate}
                aria-label="Save reading"
              >
                <Check size={14} />
              </button>
            </div>
            {confirmLower && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--amber)', flexWrap: 'wrap' }}>
                <span>Lower than current — confirm?</span>
                <button
                  style={{ ...btnSecondary, padding: '2px 8px', fontSize: '0.6875rem', color: 'var(--amber)', borderColor: 'var(--amber)' }}
                  onClick={commitUpdate}
                >
                  Confirm
                </button>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.6875rem', padding: 0 }}
                  onClick={() => setConfirmLower(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (readOnly) return null;

  if (addOpen) {
    return (
      <div style={{ ...cardStyle, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Add meter</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={unitDraft}
            onChange={e => setUnitDraft(e.target.value)}
            style={{ ...inputStyle, width: 88, flexShrink: 0 }}
            aria-label="Meter unit"
          >
            <option value="km">km</option>
            <option value="h">h</option>
            <option value="cycles">cycles</option>
            <option value="uses">uses</option>
            <option value="other">other…</option>
          </select>
          {unitDraft === 'other' && (
            <input
              value={unitCustom}
              onChange={e => setUnitCustom(e.target.value)}
              placeholder="unit"
              style={{ ...inputStyle, width: 72, flexShrink: 0 }}
              aria-label="Custom meter unit"
            />
          )}
          <input
            type="number"
            min={0}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') resetForms();
            }}
            placeholder="Value"
            autoFocus
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            aria-label="Meter value"
          />
          <button
            style={{ ...btnPrimary, padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
            onClick={commitAdd}
            aria-label="Save meter"
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft('');
        setAddOpen(true);
      }}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Gauge size={12} /> + Add meter (km, hours…)
    </button>
  );
}
