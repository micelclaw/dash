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

import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/services/api';
import { fmtMoney } from '@/modules/inventory/types';
import type { InventoryLocation, InventoryValuation } from '@/modules/inventory/types';

// Paleta determinista por índice — armónica con el ámbar del módulo pero
// con tonos suficientemente distintos para distinguir segmentos de un vistazo.
const PALETTE = ['#d97706', '#0ea5e9', '#10b981', '#8b5cf6', '#f43f5e', '#14b8a6', '#f59e0b', '#ec4899', '#84cc16', '#64748b'];

// Emoji por categoría conocida (best-effort, da color/jerarquía sin imponer
// taxonomía: las categorías son texto libre del usuario/agente).
const CATEGORY_EMOJI: Record<string, string> = {
  vehicle: '🚗', electronics: '💻', electronica: '💻', appliance: '🔌', electrodomestico: '🔌',
  tool: '🔧', herramienta: '🔧', sport: '🚲', deporte: '🚲', furniture: '🛋️', mueble: '🛋️',
  consumable: '📦', consumible: '📦', seguro: '🛡️', insurance: '🛡️', jewelry: '💍', joya: '💍',
  clothing: '👕', ropa: '👕', book: '📚', libro: '📚', kitchen: '🍳', cocina: '🍳',
};

function prettyCategory(key: string): string {
  if (!key || key === 'uncategorized' || key === 'no-category') return 'Sin categoría';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function emojiFor(key: string): string {
  return CATEGORY_EMOJI[key?.toLowerCase()] ?? '🏷️';
}

interface Slice {
  key: string;
  name: string;
  emoji: string;
  color: string;
  value: number;
  count: number;
}

// ── Tooltip compartido ─────────────────────────────────────────────
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name?: string; emoji?: string; value?: number; count?: number } }> }) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {d.emoji && <span aria-hidden>{d.emoji}</span>}
        {d.name}
      </div>
      <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        {fmtMoney(d.value)}
        {typeof d.count === 'number' && <span style={{ marginLeft: 6 }}>· {d.count} {d.count === 1 ? 'item' : 'items'}</span>}
      </div>
    </div>
  );
}

// ── Marco de tarjeta (coherente con WidgetCard del PanelTab) ───────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Donut de valor por categoría + leyenda ─────────────────────────
function ValueByCategory({ valuation }: { valuation: InventoryValuation | null }) {
  const slices = useMemo<Slice[]>(() => {
    if (!valuation) return [];
    return valuation.groups
      .map((g, i) => ({
        key: g.key,
        name: prettyCategory(g.key),
        emoji: emojiFor(g.key),
        color: PALETTE[i % PALETTE.length],
        value: g.value,
        count: g.item_count,
      }))
      .filter((s) => s.value > 0);
  }, [valuation]);

  const total = useMemo(() => slices.reduce((a, s) => a + s.value, 0), [slices]);

  if (slices.length === 0) {
    return <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }}>Sin datos de valor todavía</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: '1 1 160px', minWidth: 150, height: 180, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={1.5} stroke="var(--card)" strokeWidth={2}>
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total en el centro del anillo */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Total</div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{fmtMoney(total)}</div>
        </div>
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 170, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{s.name}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{fmtMoney(s.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Barras horizontales de valor por ubicación ─────────────────────
function ValueByLocation({ locations }: { locations: InventoryLocation[] }) {
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ data: InventoryValuation }>('/inventory/reports/valuation', { group_by: 'location' })
      .then((res) => { if (alive) { setValuation(res.data); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const nameById = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  const rows = useMemo(() => {
    if (!valuation) return [];
    return valuation.groups
      .map((g, i) => ({
        name: g.key === 'no-location' ? 'Sin ubicación' : (nameById.get(g.key) ?? 'Ubicación'),
        value: g.value,
        count: g.item_count,
        color: PALETTE[i % PALETTE.length],
      }))
      .filter((r) => r.value > 0)
      .slice(0, 8);
  }, [valuation, nameById]);

  if (!loaded) {
    return <div style={{ height: 180, borderRadius: 'var(--radius-sm)', background: 'var(--surface)', opacity: 0.5 }} />;
  }
  if (rows.length === 0) {
    return <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }}>Sin ubicaciones con valor</div>;
  }

  const height = Math.max(140, rows.length * 30 + 16);
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 12, bottom: 2, left: 2 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bloque de gráficas del Panel/Overview: valor por categoría (donut) + valor
 * por ubicación (barras). Solo se renderiza si hay valor que mostrar; los datos
 * de categoría llegan por prop (compartidos con la metric card "Total value")
 * y los de ubicación se cargan aquí localmente.
 */
export function PanelCharts({ categoryValuation, locations }: { categoryValuation: InventoryValuation | null; locations: InventoryLocation[] }) {
  const hasValue = (categoryValuation?.total ?? 0) > 0;
  if (!hasValue) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
      <ChartCard title="Value by category">
        <ValueByCategory valuation={categoryValuation} />
      </ChartCard>
      <ChartCard title="Value by location">
        <ValueByLocation locations={locations} />
      </ChartCard>
    </div>
  );
}
