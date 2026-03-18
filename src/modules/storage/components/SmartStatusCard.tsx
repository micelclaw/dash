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

import { useStorageStore } from '@/stores/storage.store';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
};

function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1000) return `${hours} hrs`;
  return `${(hours / 1000).toFixed(1)}k hrs`;
}

export function SmartStatusCard() {
  const disks = useStorageStore((s) => s.disks);
  const smart_cache = useStorageStore((s) => s.smart_cache);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        SMART Health
      </div>

      {disks.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No disks available
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
          <thead>
            <tr>
              {['Disk', 'Health', 'Temp', 'Power-On', 'Bad Sectors'].map((h) => (
                <th key={h} style={{
                  textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 500,
                  color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
                  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disks.map((disk) => {
              const smart = smart_cache[disk.id];
              if (!smart) {
                return (
                  <tr key={disk.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{disk.device}</td>
                    <td colSpan={4} style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Click disk to load SMART data
                    </td>
                  </tr>
                );
              }
              const healthColor = HEALTH_COLORS[smart.overall_status] ?? '#6b7280';
              const badSectors = smart.reallocated_sectors + smart.pending_sectors;
              return (
                <tr key={disk.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{disk.device}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor }} />
                      <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{smart.overall_status}</span>
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {smart.temperature_c != null ? `${smart.temperature_c}°C` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatHours(smart.power_on_hours)}
                  </td>
                  <td style={{
                    padding: '8px 12px', fontFamily: 'var(--font-mono, monospace)',
                    color: badSectors > 0 ? '#f43f5e' : 'var(--text-dim)',
                    fontWeight: badSectors > 0 ? 600 : 400,
                  }}>
                    {badSectors}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
