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

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Wrench, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { fmtMeter, type InventoryItem, type InventoryMaintenancePlan } from '@/modules/inventory/types';

const sectionLabel: CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--text-dim)',
};
const inputStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text)', padding: '6px 8px', fontSize: '0.8125rem', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnPrimary: CSSProperties = {
  background: 'var(--amber)', color: '#06060a', fontWeight: 600, border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: '0.8125rem', cursor: 'pointer',
};
const btnSecondary: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

function fmtDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "cada 4.000 km" / "cada 12 meses". */
function intervalLabel(plan: InventoryMaintenancePlan): string {
  const parts: string[] = [];
  if (plan.interval_meter != null) parts.push(`every ${fmtMeter(plan.interval_meter, plan.meter_unit)}`);
  if (plan.interval_months != null) parts.push(`every ${plan.interval_months} month${plan.interval_months === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'no interval';
}

/** "next at 16,000 km" / "next 1 Sep 2026". */
function nextDueLabel(plan: InventoryMaintenancePlan): string {
  if (plan.next_due_meter != null) return `next at ${fmtMeter(plan.next_due_meter, plan.meter_unit)}`;
  if (plan.next_due_date) return `next ${fmtDate(plan.next_due_date)}`;
  return '—';
}

interface NewPlanForm {
  name: string;
  recurrence: 'meter' | 'months';
  interval: string;
  meterUnit: string;
  anchor: string;
}

/**
 * Planes de mantenimiento del activo (Workstream B). Crear rutinas por medidor
 * o por tiempo; al actualizar el medidor del item (en la tarjeta de arriba), si
 * una rutina cruza su umbral, el backend genera una ORDEN automáticamente.
 */
export function MaintenancePlansSection({ item }: { item: InventoryItem }) {
  const itemId = item.id;
  const [plans, setPlans] = useState<InventoryMaintenancePlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewPlanForm>({
    name: '', recurrence: 'meter', interval: '', meterUnit: item.meter_unit ?? 'km', anchor: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: InventoryMaintenancePlan[] }>(`/inventory/items/${itemId}/maintenance-plans`);
      setPlans(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [itemId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    const name = form.name.trim();
    const interval = parseFloat(form.interval);
    if (!name) { toast.error('Name is required'); return; }
    if (!Number.isFinite(interval) || interval <= 0) { toast.error('Interval must be greater than 0'); return; }
    const body: Record<string, unknown> = { name };
    if (form.recurrence === 'meter') {
      body.interval_meter = interval;
      body.meter_unit = form.meterUnit.trim() || item.meter_unit || 'km';
      // ancla por defecto: la lectura actual del medidor (la 1ª orden cae +intervalo)
      const anchor = form.anchor.trim() !== '' ? parseFloat(form.anchor) : (item.meter_value != null ? parseFloat(item.meter_value) : 0);
      if (Number.isFinite(anchor)) body.anchor_meter = anchor;
    } else {
      body.interval_months = Math.round(interval);
      if (form.anchor.trim()) body.anchor_date = form.anchor.trim();
    }
    setBusy(true);
    try {
      await api.post(`/inventory/items/${itemId}/maintenance-plans`, body);
      toast.success('Maintenance plan created');
      setShowForm(false);
      setForm({ name: '', recurrence: 'meter', interval: '', meterUnit: item.meter_unit ?? 'km', anchor: '' });
      await load();
    } catch {
      toast.error('Could not create plan');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (plan: InventoryMaintenancePlan) => {
    try {
      await api.patch(`/inventory/maintenance-plans/${plan.id}`, { active: !plan.active });
      await load();
    } catch {
      toast.error('Could not update plan');
    }
  };

  const remove = async (plan: InventoryMaintenancePlan) => {
    try {
      await api.delete(`/inventory/maintenance-plans/${plan.id}`);
      toast.success('Plan removed');
      await load();
    } catch {
      toast.error('Could not remove plan');
    }
  };

  if (loaded && plans.length === 0 && !showForm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...sectionLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={12} /> Maintenance
          </span>
          <button style={btnSecondary} onClick={() => setShowForm(true)}>
            <Plus size={12} /> New plan
          </button>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          No maintenance plans. Add one to get an order when the meter (or time) reaches the interval.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...sectionLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Wrench size={12} /> Maintenance
        </span>
        {!showForm && (
          <button style={btnSecondary} onClick={() => setShowForm(true)}>
            <Plus size={12} /> New plan
          </button>
        )}
      </div>

      {plans.map(plan => (
        <div
          key={plan.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            opacity: plan.active ? 1 : 0.55,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {plan.name}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              {intervalLabel(plan)} · <span style={{ color: 'var(--mod-inventory)' }}>{nextDueLabel(plan)}</span>
            </div>
          </div>
          <button
            style={{ ...btnSecondary, padding: '2px 8px' }}
            onClick={() => void toggle(plan)}
            title={plan.active ? 'Disable plan' : 'Enable plan'}
          >
            {plan.active ? 'On' : 'Off'}
          </button>
          <button
            style={{ ...btnSecondary, padding: 4, color: 'var(--text-dim)', border: 'none' }}
            onClick={() => void remove(plan)}
            aria-label="Remove plan"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <input
            style={inputStyle}
            placeholder="Routine name (e.g. Oil change)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            aria-label="Plan name"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              style={{ ...inputStyle, width: 110, flexShrink: 0 }}
              value={form.recurrence}
              onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as 'meter' | 'months' }))}
              aria-label="Recurrence type"
            >
              <option value="meter">By meter</option>
              <option value="months">By time</option>
            </select>
            <input
              style={inputStyle}
              type="number"
              min="0"
              placeholder={form.recurrence === 'meter' ? 'every N (km/h…)' : 'every N months'}
              value={form.interval}
              onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
              aria-label="Interval"
            />
            {form.recurrence === 'meter' && (
              <input
                style={{ ...inputStyle, width: 64, flexShrink: 0 }}
                placeholder="km"
                value={form.meterUnit}
                onChange={e => setForm(f => ({ ...f, meterUnit: e.target.value }))}
                aria-label="Meter unit"
              />
            )}
          </div>
          <input
            style={inputStyle}
            type={form.recurrence === 'months' ? 'date' : 'number'}
            placeholder={form.recurrence === 'meter' ? `Anchor reading (default ${item.meter_value ?? 0})` : 'Anchor date (optional)'}
            value={form.anchor}
            onChange={e => setForm(f => ({ ...f, anchor: e.target.value }))}
            aria-label="Anchor"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={{ ...btnSecondary, padding: '6px 12px' }} disabled={busy} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void create()}>
              {busy ? 'Saving…' : 'Create plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
