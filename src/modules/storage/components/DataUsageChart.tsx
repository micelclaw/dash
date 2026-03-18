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

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import type { DataCategoryResult } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  // User
  drive: '#3b82f6',
  photos: '#8b5cf6',
  attachments: '#06b6d4',
  // Others
  other_users: '#a78bfa',
  // System
  models: '#10b981',
  database: '#f59e0b',
  media: '#ec4899',
  crypto: '#f97316',
  backups: '#6366f1',
};

const DEFAULT_COLOR = '#6b7280';

const GROUP_LABELS: Record<string, string> = {
  user: 'Tu almacenamiento',
  others: 'Otros usuarios',
  system: 'Sistema',
};

function formatCacheAge(seconds: number): string {
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  return `${minutes} min ago`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      padding: '8px 12px', background: '#1a1a24', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{d.label}</div>
      <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
        {d.size_bytes > 0 ? formatFileSize(d.size_bytes) : d.status === 'calculating' ? 'Calculating...' : '0 B'}
      </div>
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
      fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '8px 0 4px 0',
    }}>
      {label}
    </div>
  );
}

function GroupedChart({ categories }: { categories: DataCategoryResult[] }) {
  const groups = ['user', 'others', 'system'] as const;

  return (
    <div>
      {groups.map((group) => {
        const items = categories.filter((c) => c.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group}>
            <GroupHeader label={GROUP_LABELS[group] ?? group} />
            <ResponsiveContainer width="100%" height={Math.max(items.length * 34, 34)}>
              <BarChart layout="vertical" data={items} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis type="number" tickFormatter={(v: number) => formatFileSize(v)} tick={{ fontSize: 11, fill: '#7a7a8a' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12, fill: '#e0e0e8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="size_bytes" radius={[0, 3, 3, 0]} maxBarSize={20}>
                  {items.map((cat) => (
                    <Cell
                      key={cat.name}
                      fill={cat.size_bytes > 0 ? (CATEGORY_COLORS[cat.name] ?? DEFAULT_COLOR) : '#2a2a38'}
                      opacity={cat.size_bytes > 0 ? 1 : 0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

export function DataUsageChart() {
  const data_usage = useStorageStore((s) => s.data_usage);

  if (!data_usage) {
    return (
      <div style={{
        padding: '20px 16px', background: 'var(--surface)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', height: 280,
      }}>
        <div style={{ height: 12, width: '40%', background: 'var(--card)', borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px', background: 'var(--surface)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Data Usage by Category
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          Updated {formatCacheAge(data_usage.cache_age_seconds)}
        </div>
      </div>

      {/* Grouped charts */}
      <GroupedChart categories={data_usage.categories} />

      {/* Total */}
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        marginTop: 8, textAlign: 'right',
      }}>
        Total data: {formatFileSize(data_usage.total_data_bytes)}
      </div>
    </div>
  );
}
