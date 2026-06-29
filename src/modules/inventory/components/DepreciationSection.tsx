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
import { TrendingDown, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { fmtMoney, type InventoryItem, type InventoryDepreciationResponse } from '@/modules/inventory/types';

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

const METHOD_LABEL: Record<string, string> = {
  straight_line: 'Straight-line',
  declining_balance: 'Declining balance',
  units_of_production: 'By usage (meter)',
};

interface DepForm {
  acquisition_cost: string;
  acquisition_date: string;
  method: 'straight_line' | 'declining_balance' | 'units_of_production';
  useful_life_months: string;
  declining_rate: string;
  units_total: string;
  salvage_value: string;
}

/**
 * Valor de un activo con depreciación (Workstream C-N1). Muestra el valor en
 * libros HOY (3 métodos; `units_of_production` usa el medidor → sinergia con el
 * mantenimiento) y permite fijar parámetros y sellar snapshots del periodo.
 */
export function DepreciationSection({ item }: { item: InventoryItem }) {
  const itemId = item.id;
  const [data, setData] = useState<InventoryDepreciationResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<DepForm>({
    acquisition_cost: item.purchase_price != null ? String(item.purchase_price) : '',
    acquisition_date: item.purchase_date ?? '',
    method: item.meter_unit ? 'units_of_production' : 'straight_line',
    useful_life_months: '60',
    declining_rate: '20',
    units_total: '',
    salvage_value: '0',
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: InventoryDepreciationResponse }>(`/inventory/items/${itemId}/depreciation`);
      setData(res.data);
      if (res.data.params) {
        const p = res.data.params;
        setForm({
          acquisition_cost: p.acquisition_cost,
          acquisition_date: p.acquisition_date,
          method: (p.method as DepForm['method']) ?? 'straight_line',
          useful_life_months: p.useful_life_months != null ? String(p.useful_life_months) : '60',
          declining_rate: p.declining_rate != null ? String(Math.round(parseFloat(p.declining_rate) * 100)) : '20',
          units_total: p.units_total != null ? p.units_total : '',
          salvage_value: p.salvage_value ?? '0',
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [itemId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const cost = parseFloat(form.acquisition_cost);
    if (!Number.isFinite(cost) || cost <= 0) { toast.error('Acquisition cost must be greater than 0'); return; }
    if (!form.acquisition_date) { toast.error('Acquisition date is required'); return; }
    const body: Record<string, unknown> = {
      acquisition_cost: cost,
      acquisition_date: form.acquisition_date,
      method: form.method,
      salvage_value: parseFloat(form.salvage_value) || 0,
    };
    if (form.method === 'straight_line') {
      body.useful_life_months = parseInt(form.useful_life_months, 10) || 60;
    } else if (form.method === 'declining_balance') {
      body.declining_rate = (parseFloat(form.declining_rate) || 20) / 100;
    } else {
      const total = parseFloat(form.units_total);
      if (!Number.isFinite(total) || total <= 0) { toast.error('Total usage (units) is required'); return; }
      body.units_total = total;
      body.units_uom = item.meter_unit ?? undefined;
    }
    setBusy(true);
    try {
      await api.post(`/inventory/items/${itemId}/depreciation`, body);
      toast.success('Depreciation saved');
      setShowForm(false);
      await load();
    } catch {
      toast.error('Could not save depreciation');
    } finally {
      setBusy(false);
    }
  };

  const snapshot = async () => {
    setBusy(true);
    try {
      await api.post(`/inventory/items/${itemId}/depreciation/snapshot`, {});
      toast.success('Book value snapshot saved');
      await load();
    } catch {
      toast.error('Could not save snapshot');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  const cur = data?.current ?? null;
  const hasParams = Boolean(data?.params);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...sectionLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TrendingDown size={12} /> Value / Depreciation
        </span>
        {!showForm && (
          <button style={btnSecondary} onClick={() => setShowForm(true)}>
            {hasParams ? 'Edit' : 'Set up'}
          </button>
        )}
      </div>

      {!showForm && !hasParams && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Track book value over time (straight-line, declining balance, or by meter usage).
        </span>
      )}

      {!showForm && cur && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Book value today</span>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{fmtMoney(cur.book_value)}</span>
          </div>
          {/* Barra de % depreciado */}
          <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, cur.percent_depreciated)}%`, height: '100%', background: 'var(--mod-inventory, var(--amber))' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            <span>{cur.percent_depreciated}% depreciated · {METHOD_LABEL[cur.method] ?? cur.method}</span>
            <span>cost {fmtMoney(cur.acquisition_cost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            <span>accumulated {fmtMoney(cur.accumulated_depreciation)}</span>
            {cur.usage_units != null
              ? <span>{cur.usage_units.toLocaleString()} {item.meter_unit ?? ''} used</span>
              : <span>~{fmtMoney(cur.period_depreciation)}/yr</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnSecondary} disabled={busy} onClick={() => void snapshot()} title="Record today's book value">
              <Camera size={12} /> Snapshot
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={inputStyle} type="number" min="0" placeholder="Acquisition cost"
              value={form.acquisition_cost}
              onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))}
              aria-label="Acquisition cost"
            />
            <input
              style={inputStyle} type="date"
              value={form.acquisition_date}
              onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
              aria-label="Acquisition date"
            />
          </div>
          <select
            style={inputStyle} value={form.method}
            onChange={e => setForm(f => ({ ...f, method: e.target.value as DepForm['method'] }))}
            aria-label="Depreciation method"
          >
            <option value="straight_line">Straight-line</option>
            <option value="declining_balance">Declining balance</option>
            <option value="units_of_production">By usage (meter)</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            {form.method === 'straight_line' && (
              <input style={inputStyle} type="number" min="1" placeholder="Useful life (months)"
                value={form.useful_life_months}
                onChange={e => setForm(f => ({ ...f, useful_life_months: e.target.value }))}
                aria-label="Useful life months" />
            )}
            {form.method === 'declining_balance' && (
              <input style={inputStyle} type="number" min="0" max="100" placeholder="Annual rate (%)"
                value={form.declining_rate}
                onChange={e => setForm(f => ({ ...f, declining_rate: e.target.value }))}
                aria-label="Declining rate percent" />
            )}
            {form.method === 'units_of_production' && (
              <input style={inputStyle} type="number" min="1" placeholder={`Total life (${item.meter_unit ?? 'units'})`}
                value={form.units_total}
                onChange={e => setForm(f => ({ ...f, units_total: e.target.value }))}
                aria-label="Units total" />
            )}
            <input style={inputStyle} type="number" min="0" placeholder="Salvage value"
              value={form.salvage_value}
              onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))}
              aria-label="Salvage value" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={{ ...btnSecondary, padding: '6px 12px' }} disabled={busy} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
