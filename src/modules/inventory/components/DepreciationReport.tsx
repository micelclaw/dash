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

import { useEffect, useState, type CSSProperties } from 'react';
import { TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/services/api';
import { fmtMoney } from '@/modules/inventory/types';

interface DepItem {
  item_id: string;
  name: string;
  method: string;
  acquisition_cost: number;
  book_value: number;
  accumulated_depreciation: number;
  percent_depreciated: number;
}
interface DepSummary {
  count: number;
  total_cost: number;
  total_book_value: number;
  total_accumulated: number;
  items: DepItem[];
}

const cardStyle: CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16,
};
const titleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 12,
};

const BOOK = 'var(--mod-inventory, #d97706)';
const ACCUM = 'var(--text-muted, #64748b)';

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: DepItem }> }) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ color: 'var(--text)', fontWeight: 600 }}>{d.name}</div>
      <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        Book {fmtMoney(d.book_value)} · {d.percent_depreciated}% depreciated
      </div>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        Cost {fmtMoney(d.acquisition_cost)}
      </div>
    </div>
  );
}

/** Valor en libros vs amortización acumulada por activo (Workstream C-N1, recharts). */
export function DepreciationReport() {
  const [data, setData] = useState<DepSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<{ data: DepSummary }>('/inventory/reports/depreciation')
      .then((res) => { if (alive) { setData(res.data); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    // Sin cleanup el guard `alive` nunca bajaba: el .then seguía llamando a
    // setState tras desmontar el informe.
    return () => { alive = false; };
  }, []);

  if (!loaded || !data || data.count === 0) return null;

  const chartHeight = Math.max(120, data.items.length * 34 + 20);

  return (
    <div style={cardStyle}>
      <div style={titleStyle}><TrendingDown size={12} /> Depreciation · book value</div>

      {/* Totales */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
        <Total label="Book value" value={data.total_book_value} accent />
        <Total label="Acquisition cost" value={data.total_cost} />
        <Total label="Accumulated" value={data.total_accumulated} />
      </div>

      {/* Barras apiladas: valor en libros + amortización = coste */}
      <div style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.items} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }} barCategoryGap="28%">
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(v) => fmtMoney(Number(v))} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface)', opacity: 0.4 }} />
            <Bar dataKey="book_value" stackId="a" fill={BOOK} radius={[3, 0, 0, 3]} />
            <Bar dataKey="accumulated_depreciation" stackId="a" fill={ACCUM} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
        <Legend color={BOOK} label="Book value (remaining)" />
        <Legend color={ACCUM} label="Accumulated depreciation" />
      </div>
    </div>
  );
}

function Total({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: accent ? 'var(--mod-inventory, var(--amber))' : 'var(--text)' }}>{fmtMoney(value)}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: color }} /> {label}
    </span>
  );
}
