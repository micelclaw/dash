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
import { useStorageStore } from '@/stores/storage.store';

function MiniBar({ percent }: { percent: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 5, background: 'var(--card)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(percent, 100)}%`,
          background: percent > 90 ? '#f43f5e' : percent > 80 ? '#f97316' : 'var(--amber)',
          borderRadius: 3,
        }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', minWidth: 32 }}>
        {percent.toFixed(0)}%
      </span>
    </div>
  );
}

export function VolumeTable() {
  const volumes = useStorageStore((s) => s.volumes);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Mounted Volumes
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {volumes.length} {volumes.length === 1 ? 'volume' : 'volumes'}
        </span>
      </div>

      {volumes.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No volumes detected
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr>
                {['Mount', 'FS', 'Size', 'Used', 'Free', 'Usage'].map((h) => (
                  <th key={h} style={{
                    textAlign: h === 'Mount' || h === 'FS' || h === 'Usage' ? 'left' : 'right',
                    padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 500,
                    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => {
                const percent = v.size_bytes > 0 ? (v.used_bytes / v.size_bytes) * 100 : 0;
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{v.mount_point}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{v.filesystem}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{formatFileSize(v.size_bytes)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{formatFileSize(v.used_bytes)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{formatFileSize(v.free_bytes)}</td>
                    <td style={{ padding: '8px 12px' }}><MiniBar percent={percent} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
