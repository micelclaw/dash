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

import { formatFileSize } from '@/lib/file-utils';
import type { StorageStatus } from '../types';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
  unknown: '#6b7280',
};

function getBarColor(percent: number): string {
  if (percent > 90) return '#f43f5e';
  if (percent > 80) return '#f97316';
  return 'var(--amber)';
}

export function StorageSummaryCard({ status }: { status: StorageStatus | null }) {
  if (!status) {
    return (
      <div style={{
        padding: '20px 16px', background: 'var(--surface)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
      }}>
        <div style={{ height: 10, width: '60%', background: 'var(--card)', borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 40, background: 'var(--card)', borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      </div>
    );
  }

  const percent = status.total_bytes > 0 ? (status.used_bytes / status.total_bytes) * 100 : 0;
  const healthColor = HEALTH_COLORS[status.health] ?? '#6b7280';
  const isUnknownHealth = status.health === 'unknown';
  const healthLabel = isUnknownHealth ? 'N/A' : status.health.charAt(0).toUpperCase() + status.health.slice(1);

  const stats = [
    { label: 'Total', value: formatFileSize(status.total_bytes) },
    { label: 'Used', value: formatFileSize(status.used_bytes) },
    { label: 'Free', value: formatFileSize(status.free_bytes) },
  ];

  return (
    <div style={{
      padding: '20px 16px', background: 'var(--surface)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
    }}>
      {/* Progress bar */}
      <div style={{
        height: 10, background: 'var(--card)', borderRadius: 5, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.min(percent, 100)}%`,
          background: getBarColor(percent), borderRadius: 5,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 6,
        fontFamily: 'var(--font-sans)', textAlign: 'right',
      }}>
        {percent.toFixed(1)}% used
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            flex: '1 1 100px', padding: '10px 12px',
            background: 'var(--card)', borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
              {s.value}
            </div>
          </div>
        ))}
        <div style={{
          flex: '1 1 100px', padding: '10px 12px',
          background: 'var(--card)', borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Health
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: healthColor, flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {healthLabel}
            </span>
          </div>
          {isUnknownHealth && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
              SMART not available — bare-metal only
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
